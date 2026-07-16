import re
from typing import Any, Optional

from .models import PerformanceAssessment
from .result_processor import LoadTestSummary


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
) -> str:
    return f"""
    너는 시니어 성능 테스트 엔지니어이자 k6 결과 분석가야.
    아래의 k6 실행 결과를 바탕으로 꼭 필요한 진단과 우선 조치만 작성해줘.

    [테스트 정보]
    - Target URL: {target_url}
    - VUs: {vusers}
    - Duration: {duration}
    - 추가 요구사항: {load_prompt}

    [k6 요약]
    - maxTps: {summary.get('real_tps', 0)}
    - avgResponse: {summary.get('real_avg_response', 0)}
    - errorRate: {summary.get('real_error_rate', 0)}
    - isServerDead: {summary.get('is_server_dead', False)}
    - score: {assessment.score}/100
    - grade: {assessment.grade} ({assessment.label})

    [출력 조건]
    1. 반드시 GitHub Flavored Markdown으로 작성할 것.
    2. `## 핵심 진단`과 `## 우선 조치` 두 섹션만 작성할 것.
    3. 핵심 진단은 불릿 최대 2개, 우선 조치는 번호 목록 최대 2개로 제한할 것.
    4. 점수, 등급, 지표 표를 다시 작성하지 말고 주어진 점수를 재계산하지 말 것.
    5. 확인되지 않은 원인을 단정하지 말고 측정 결과로 뒷받침되는 내용만 쓸 것.
    6. 서론, 결론, 코드 블록, 전체 테스트 정보 반복은 포함하지 말 것.
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
    fallback = build_fallback_analysis(summary)

    try:
        prompt = build_analysis_prompt(
            summary,
            assessment,
            target_url,
            vusers,
            duration,
            load_prompt,
        )
        response = await client.aio.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
        )
        analysis_text = response.text.strip() if response.text is not None else ""
        sanitized_analysis = sanitize_analysis_markdown(analysis_text)
        if sanitized_analysis is None or len(sanitized_analysis) > 1500:
            return fallback
        return sanitized_analysis
    except Exception:
        return fallback


def build_markdown_report(
    summary: LoadTestSummary,
    assessment: PerformanceAssessment,
    analysis: str,
) -> str:
    max_tps = float(summary.get("real_tps", 0))
    avg_response = float(summary.get("real_avg_response", 0))
    error_rate = float(summary.get("real_error_rate", 0))

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

    return f"""# 부하 테스트 결과

> **성능 점수: {assessment.score}/100 · {assessment.grade} ({assessment.label})**

## 핵심 지표

| 항목 | 측정 결과 | 판정 |
| --- | ---: | --- |
| 최대 TPS | **{max_tps:.0f} req/s** | 목표치 미설정 · 채점 제외 |
| 평균 응답시간 | **{avg_response:.2f} ms** | {latency_label} |
| 오류율 | **{error_rate:.2f}%** | {reliability_label} |

**점수 구성:** 안정성 {assessment.breakdown.reliabilityScore}/60 · 응답성 {assessment.breakdown.latencyScore}/40

_FlowCheck 채점 기준: 오류율 0%는 60점, 5% 이상은 0점이며 구간 내 선형 감점합니다. 평균 응답시간은 200ms 이하 40점, 500ms 30점, 1초 15점, 2초 이상 0점이며 구간 내 선형 감점합니다._

{analysis}
""".strip()
