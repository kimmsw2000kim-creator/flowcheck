import json
import logging
import re
from typing import Any, Optional

from pydantic import BaseModel, Field, ValidationError

from .analysis_engine import (
    AnalysisAction,
    LoadAnalysisContext,
    StructuredAnalysisReport,
    build_analysis_context,
)
from .models import PerformanceAssessment
from .result_processor import LoadTestSummary


logger = logging.getLogger(__name__)


class ModelAnalysisPayload(BaseModel):
    verdict: str = Field(min_length=1, max_length=500)
    actions: list[AnalysisAction] = Field(min_length=1, max_length=3)
    limitations: list[str] = Field(default_factory=list, max_length=3)


def build_fallback_analysis(summary: LoadTestSummary) -> str:
    if summary.get("is_server_dead"):
        return """## 핵심 진단
- 유효한 성공 요청이 없어 대상 서비스가 부하를 정상 처리하지 못한 것으로 판단됩니다.

## 우선 조치
1. 대상 서버의 가용 상태와 네트워크 접근성을 확인합니다.
2. 서버 로그에서 연결 실패, 타임아웃 또는 5xx 원인을 먼저 제거합니다."""

    error_rate = float(summary.get("real_error_rate", 0))
    avg_response = float(summary.get("real_avg_response", 0))
    diagnostics = []
    actions = []

    if error_rate > 1:
        diagnostics.append(f"오류율 {error_rate:.2f}%로 안정성 저하가 확인됩니다.")
        actions.append(
            "실패 응답의 상태 코드와 서버 로그를 대조해 주요 오류 원인을 제거합니다."
        )
    else:
        diagnostics.append(f"오류율 {error_rate:.2f}%로 요청 안정성은 양호합니다.")

    if avg_response > 500:
        diagnostics.append(
            f"평균 응답시간 {avg_response:.2f}ms로 응답 지연 개선이 필요합니다."
        )
        actions.append(
            "CPU, DB 쿼리, 외부 API 호출 시간을 측정해 가장 큰 지연 구간부터 최적화합니다."
        )
    else:
        diagnostics.append(
            f"평균 응답시간 {avg_response:.2f}ms로 응답성은 기준 범위에 있습니다."
        )

    if not actions:
        actions.append(
            "현재 성능 수준을 회귀 테스트 기준값으로 저장해 이후 변경과 비교합니다."
        )
        actions.append(
            "서비스 목표 TPS를 정의한 뒤 처리량 충족 여부를 별도로 검증합니다."
        )

    diagnostic_markdown = "\n".join(f"- {item}" for item in diagnostics[:2])
    action_markdown = "\n".join(
        f"{index}. {item}" for index, item in enumerate(actions[:2], start=1)
    )
    return f"## 핵심 진단\n{diagnostic_markdown}\n\n## 우선 조치\n{action_markdown}"


def sanitize_analysis_markdown(markdown: str) -> Optional[str]:
    diagnostics = []
    actions = []
    section = None

    for raw_line in markdown.splitlines():
        line = raw_line.strip()
        if line == "## 핵심 진단":
            section = "diagnostics"
            continue
        if line == "## 우선 조치":
            section = "actions"
            continue

        if section == "diagnostics" and line.startswith(("- ", "* ")):
            content = line[2:].strip()
            if content and len(diagnostics) < 2:
                diagnostics.append(content)
            continue

        if section == "actions":
            match = re.match(r"^\d+[.)]\s+(.+)$", line)
            if match and len(actions) < 2:
                actions.append(match.group(1).strip())

    if not diagnostics or not actions:
        return None

    diagnostic_markdown = "\n".join(f"- {item}" for item in diagnostics)
    action_markdown = "\n".join(
        f"{index}. {item}" for index, item in enumerate(actions, start=1)
    )
    return f"## 핵심 진단\n{diagnostic_markdown}\n\n## 우선 조치\n{action_markdown}"


def build_analysis_prompt(
    summary: LoadTestSummary,
    assessment: PerformanceAssessment,
    target_url: str,
    vusers: int,
    duration: int,
    load_prompt: str,
    context: Optional[LoadAnalysisContext] = None,
) -> str:
    analysis_context = context or build_analysis_context(summary)
    return f"""
    너는 시니어 성능 테스트 엔지니어이자 k6 결과 분석가야.
    아래의 사전 계산된 k6 분석 결과만 근거로 종합 판정과 우선 조치를 작성해줘.

    [테스트 정보]
    - Target URL: {target_url}
    - VUs: {vusers}
    - Duration: {duration}
    - 추가 요구사항: {load_prompt}

    [k6 요약]
    - totalRequests: {summary.get('real_request_count', 0)}
    - avgTps: {summary.get('real_tps', 0)}
    - maxTps: {summary.get('max_tps')}
    - avgResponse: {summary.get('real_avg_response', 0)}
    - p95Response: {summary.get('p95_response')}
    - errorRate: {summary.get('real_error_rate', 0)}
    - isServerDead: {summary.get('is_server_dead', False)}
    - score: {assessment.score}/100
    - grade: {assessment.grade} ({assessment.label})

    [단계별 분석 및 병목 신호]
    {json.dumps(analysis_context.model_dump(), ensure_ascii=False)}

    [출력 조건]
    1. JSON 객체만 반환하고 마크다운 코드 블록은 사용하지 말 것.
    2. 형식은 {{"verdict": string, "actions": [{{"priority": 1~3, "title": string, "rationale": string, "evidence": string}}], "limitations": [string]}}을 따를 것.
    3. actions는 최대 3개이며 evidence에는 반드시 제공된 VU, TPS, p95, 오류율 중 하나 이상의 수치를 포함할 것.
    4. 점수를 재계산하지 말고 확인되지 않은 CPU, DB, 네트워크 원인을 단정하지 말 것.
    5. 시계열이 없거나 일부만 유효하면 limitations에 그 한계를 명시할 것.
    """


async def generate_analysis_report(
    client: Any,
    summary: LoadTestSummary,
    assessment: PerformanceAssessment,
    target_url: str,
    vusers: int,
    duration: int,
    load_prompt: str,
) -> str:
    context = build_analysis_context(summary)
    report = await generate_structured_analysis_report(
        client,
        summary,
        assessment,
        target_url,
        vusers,
        duration,
        load_prompt,
        context,
    )
    return render_structured_analysis(report)


async def generate_structured_analysis_report(
    client: Any,
    summary: LoadTestSummary,
    assessment: PerformanceAssessment,
    target_url: str,
    vusers: int,
    duration: int,
    load_prompt: str,
    context: LoadAnalysisContext,
) -> StructuredAnalysisReport:
    fallback_payload = _build_fallback_payload(summary, context)

    try:
        prompt = build_analysis_prompt(
            summary,
            assessment,
            target_url,
            vusers,
            duration,
            load_prompt,
            context,
        )
        response = await client.aio.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
        )
        analysis_text = response.text.strip() if response.text is not None else ""
        payload = ModelAnalysisPayload.model_validate_json(clean_json_response(analysis_text))
        _validate_action_evidence(payload)
        logger.info("Load-test analysis generated successfully with the language model")
        return _assemble_structured_report(payload, context, "LLM")
    except (ValidationError, ValueError, json.JSONDecodeError):
        logger.warning("Load-test analysis fell back because the model output was invalid")
        return _assemble_structured_report(fallback_payload, context, "FALLBACK_INVALID")
    except Exception:
        logger.exception("Load-test analysis fell back because model generation failed")
        return _assemble_structured_report(fallback_payload, context, "FALLBACK_ERROR")


def clean_json_response(text: str) -> str:
    return text.replace("```json", "").replace("```", "").strip()


def _validate_action_evidence(payload: ModelAnalysisPayload) -> None:
    if any(not re.search(r"\d", action.evidence) for action in payload.actions):
        raise ValueError("Every action evidence must contain a measured number")


def _assemble_structured_report(
    payload: ModelAnalysisPayload,
    context: LoadAnalysisContext,
    source: str,
) -> StructuredAnalysisReport:
    return StructuredAnalysisReport(
        generationSource=source,
        verdict=payload.verdict,
        stages=context.stages,
        bottlenecks=context.bottlenecks,
        actions=payload.actions,
        limitations=payload.limitations,
        sustainableTps=None,
    )


def _build_fallback_payload(
    summary: LoadTestSummary,
    context: LoadAnalysisContext,
) -> ModelAnalysisPayload:
    avg_response = float(summary.get("real_avg_response", 0))
    error_rate = float(summary.get("real_error_rate", 0))
    avg_tps = float(summary.get("real_tps", 0))
    signals = {signal.type: signal for signal in context.bottlenecks}
    actions: list[AnalysisAction] = []

    if "THROUGHPUT_SATURATION" in signals:
        signal = signals["THROUGHPUT_SATURATION"]
        actions.append(AnalysisAction(
            priority=1,
            title="포화 구간의 처리량 제한 요인 확인",
            rationale="고부하 구간에서 VU 증가 대비 처리량 확장이 둔화됐습니다.",
            evidence=signal.evidence,
        ))
    if "TAIL_LATENCY_DEGRADATION" in signals:
        signal = signals["TAIL_LATENCY_DEGRADATION"]
        actions.append(AnalysisAction(
            priority=min(3, len(actions) + 1),
            title="고부하 꼬리 지연 구간 추적",
            rationale="평균값보다 p95 지연이 크게 증가한 요청 구간을 우선 추적해야 합니다.",
            evidence=signal.evidence,
        ))
    if "ERROR_RATE_INCREASE" in signals and len(actions) < 3:
        signal = signals["ERROR_RATE_INCREASE"]
        actions.append(AnalysisAction(
            priority=min(3, len(actions) + 1),
            title="오류 발생 시점의 응답 상태 확인",
            rationale="오류가 처음 증가한 시점의 상태 코드와 요청 로그를 대조해야 합니다.",
            evidence=signal.evidence,
        ))
    if not actions:
        actions.append(AnalysisAction(
            priority=1,
            title="현재 결과를 회귀 기준으로 보존",
            rationale="관측된 시계열에서 명확한 포화 또는 오류 증가 신호가 확인되지 않았습니다.",
            evidence=(
                f"평균 TPS {avg_tps:.2f}, 평균 응답시간 {avg_response:.2f}ms, "
                f"오류율 {error_rate:.2f}%입니다."
            ),
        ))

    limitations = []
    if not context.stages:
        limitations.append("실측 시계열이 없어 전체 요약 지표만 분석했습니다.")
    elif context.coverageRatio < 0.9:
        limitations.append(
            f"필수 시계열 지표 유효 비율이 {context.coverageRatio * 100:.1f}%입니다."
        )
    verdict = (
        "관측된 단계별 지표에서 성능 저하 신호가 확인됩니다."
        if context.bottlenecks
        else "관측된 지표 범위에서는 뚜렷한 단계별 성능 저하 신호가 없습니다."
    )
    return ModelAnalysisPayload(verdict=verdict, actions=actions[:3], limitations=limitations)


def render_structured_analysis(report: StructuredAnalysisReport) -> str:
    lines = ["## 종합 판정", report.verdict]
    if report.bottlenecks:
        lines.extend(["", "## 병목 징후"])
        lines.extend(f"- {signal.evidence}" for signal in report.bottlenecks)
    lines.extend(["", "## 우선 조치"])
    lines.extend(
        f"{action.priority}. **{action.title}** — {action.rationale} 근거: {action.evidence}"
        for action in report.actions
    )
    if report.limitations:
        lines.extend(["", "## 분석 한계"])
        lines.extend(f"- {limitation}" for limitation in report.limitations)
    return "\n".join(lines)


def build_markdown_report(
    summary: LoadTestSummary,
    assessment: PerformanceAssessment,
    analysis: str,
) -> str:
    total_requests = int(summary.get("real_request_count", 0))
    avg_tps = float(summary.get("real_tps", 0))
    max_tps_value = summary.get("max_tps")
    p95_response_value = summary.get("p95_response")
    avg_response = float(summary.get("real_avg_response", 0))
    error_rate = float(summary.get("real_error_rate", 0))
    max_tps = f"{float(max_tps_value):.0f} req/s" if max_tps_value is not None else "측정 불가"
    p95_response = (
        f"{float(p95_response_value):.2f} ms"
        if p95_response_value is not None
        else "측정 불가"
    )

    if summary.get("is_server_dead"):
        latency_label = "측정 불가"
    elif avg_response <= 200:
        latency_label = "우수"
    elif avg_response <= 500:
        latency_label = "양호"
    elif avg_response <= 1000:
        latency_label = "주의"
    elif avg_response < 2000:
        latency_label = "개선 필요"
    else:
        latency_label = "위험"

    if summary.get("is_server_dead"):
        reliability_label = "요청 처리 실패"
    elif error_rate == 0:
        reliability_label = "오류 없음"
    elif error_rate <= 1:
        reliability_label = "양호"
    elif error_rate < 5:
        reliability_label = "개선 필요"
    else:
        reliability_label = "위험"

    score_breakdown = (
        f"신뢰성 {assessment.breakdown.reliabilityScore}/40 · "
        f"꼬리 지연 {assessment.breakdown.latencyScore}/40 · "
        f"확장성 {assessment.breakdown.scalabilityScore}/20"
        if assessment.breakdown.scalabilityScore is not None
        else (
            f"안정성 {assessment.breakdown.reliabilityScore}/60 · "
            f"응답성 {assessment.breakdown.latencyScore}/40"
        )
    )
    scoring_note = (
        "_FlowCheck 점수 v2: 신뢰성은 목표 오류율, 꼬리 지연은 목표 p95, 확장성은 "
        "중·고부하 TPS/VU 유지율과 선택한 목표 TPS 달성도를 기준으로 계산합니다._"
        if assessment.breakdown.scalabilityScore is not None
        else (
            "_FlowCheck 채점 기준: 오류율 0%는 60점, 5% 이상은 0점이며 구간 내 선형 감점합니다. "
            "평균 응답시간은 200ms 이하 40점, 500ms 30점, 1초 15점, 2초 이상 0점이며 "
            "구간 내 선형 감점합니다._"
        )
    )

    return f"""# 부하 테스트 결과

> **성능 점수: {assessment.score}/100 · {assessment.grade} ({assessment.label})**

## 핵심 지표

| 항목 | 측정 결과 | 판정 |
| --- | ---: | --- |
| 총 요청 수 | **{total_requests:,}건** | - |
| 평균 TPS | **{avg_tps:.2f} req/s** | - |
| 최대 TPS | **{max_tps}** | 목표치 미설정 · 채점 제외 |
| 평균 응답시간 | **{avg_response:.2f} ms** | {latency_label} |
| p95 응답시간 | **{p95_response}** | - |
| 오류율 | **{error_rate:.2f}%** | {reliability_label} |

**점수 구성:** {score_breakdown}

{scoring_note}

{analysis}
""".strip()
