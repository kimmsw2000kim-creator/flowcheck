import uuid
import json
import logging
import math
import os
import random
import re
import asyncio
from typing import Any, List, Optional

import httpx
import boto3
from botocore.exceptions import ClientError
from pydantic import BaseModel

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get("AWS_REGION", "ap-northeast-2")

try:
    S3_BUCKET = os.environ["S3_BUCKET"]
    ECS_CLUSTER = os.environ["ECS_CLUSTER"]
    ECS_TASK_FAMILY = os.environ["ECS_TASK_FAMILY"]
    ECS_SUBNET_ID = os.environ["ECS_SUBNET_ID"]
    ECS_SECURITY_GROUP_ID = os.environ["ECS_SECURITY_GROUP_ID"]
except KeyError as e:
    raise RuntimeError(f"필수 환경 변수가 설정되지 않았습니다: {e}")

s3_client = boto3.client('s3', region_name=AWS_REGION)
ecs_client = boto3.client('ecs', region_name=AWS_REGION)

class LoadTestGenerationError(RuntimeError):
    pass


class LoadTestExecutionError(RuntimeError):
    pass


class ChartPoint(BaseModel):
    time: str
    tps: int
    avgResponse: float


class ScoreBreakdown(BaseModel):
    reliabilityScore: int
    latencyScore: int


class PerformanceAssessment(BaseModel):
    score: int
    grade: str
    label: str
    breakdown: ScoreBreakdown


class TestResultsResponse(BaseModel):
    maxTps: int
    avgResponse: float
    errorRate: float
    performanceScore: int
    performanceGrade: str
    scoreLabel: str
    scoreBreakdown: ScoreBreakdown
    bottleneckComment: str
    points: List[ChartPoint]


class LoadTestProgressUpdate(BaseModel):
    status: str
    phase: str
    progress: int
    message: str


def round_score(value: float) -> int:
    return int(math.floor(value + 0.5))


def calculate_performance_assessment(summary: dict) -> PerformanceAssessment:
    if summary.get("is_server_dead"):
        reliability_score = 0
        latency_score = 0
    else:
        error_rate = max(0.0, float(summary.get("real_error_rate", 0)))
        avg_response = max(0.0, float(summary.get("real_avg_response", 0)))

        reliability_score = round_score(60 * max(0.0, 1 - (error_rate / 5)))

        if avg_response <= 200:
            latency_points = 40
        elif avg_response <= 500:
            latency_points = 40 - ((avg_response - 200) / 300 * 10)
        elif avg_response <= 1000:
            latency_points = 30 - ((avg_response - 500) / 500 * 15)
        elif avg_response < 2000:
            latency_points = 15 - ((avg_response - 1000) / 1000 * 15)
        else:
            latency_points = 0

        latency_score = round_score(max(0.0, latency_points))

    score = max(0, min(100, reliability_score + latency_score))

    if score >= 90:
        grade, label = "A", "우수"
    elif score >= 80:
        grade, label = "B", "양호"
    elif score >= 70:
        grade, label = "C", "보통"
    elif score >= 60:
        grade, label = "D", "개선 필요"
    else:
        grade, label = "F", "위험"

    return PerformanceAssessment(
        score=score,
        grade=grade,
        label=label,
        breakdown=ScoreBreakdown(
            reliabilityScore=reliability_score,
            latencyScore=latency_score,
        ),
    )


def build_fallback_analysis(summary: dict) -> str:
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
        actions.append("실패 응답의 상태 코드와 서버 로그를 대조해 주요 오류 원인을 제거합니다.")
    else:
        diagnostics.append(f"오류율 {error_rate:.2f}%로 요청 안정성은 양호합니다.")

    if avg_response > 500:
        diagnostics.append(f"평균 응답시간 {avg_response:.2f}ms로 응답 지연 개선이 필요합니다.")
        actions.append("CPU, DB 쿼리, 외부 API 호출 시간을 측정해 가장 큰 지연 구간부터 최적화합니다.")
    else:
        diagnostics.append(f"평균 응답시간 {avg_response:.2f}ms로 응답성은 기준 범위에 있습니다.")

    if not actions:
        actions.append("현재 성능 수준을 회귀 테스트 기준값으로 저장해 이후 변경과 비교합니다.")
        actions.append("서비스 목표 TPS를 정의한 뒤 처리량 충족 여부를 별도로 검증합니다.")

    diagnostic_markdown = "\n".join(f"- {item}" for item in diagnostics[:2])
    action_markdown = "\n".join(f"{index}. {item}" for index, item in enumerate(actions[:2], start=1))
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
    action_markdown = "\n".join(f"{index}. {item}" for index, item in enumerate(actions, start=1))
    return f"## 핵심 진단\n{diagnostic_markdown}\n\n## 우선 조치\n{action_markdown}"


def build_analysis_prompt(
    summary: dict,
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
    client,
    summary: dict,
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
    summary: dict,
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


def build_k6_system_prompt(target_url: str, vusers: int, duration: int, load_prompt: str) -> str:
    return f"""
    너는 시니어 성능 테스트 엔지니어이자 k6 전문가야.
    다음 요구사항을 바탕으로 완벽하게 동작하는 k6 자바스크립트 코드를 작성해줘.

    [요구사항]
    - Target URL: {target_url}
    - 기본 가상 유저(VUs): {vusers}명
    - 테스트 지속 시간: {duration}초
    - 추가 시나리오 요건: {load_prompt}

    [조건]
    1. '추가 시나리오 요건'에 점진적 증가(Ramp-up)나 특정 부하 패턴이 명시되어 있다면, k6의 `stages` 옵션을 우선 고려하여 시나리오를 구성할 것.
    2. 특별한 시나리오 요건이 없다면 기본 `vus`와 `duration` 옵션을 사용할 것.
    3. 시나리오 요건에 맞는 HTTP 메서드와 대기 시간(Think time)을 구성할 것.
    3. 마크다운 기호(```javascript ... ```)를 절대 사용하지 말고, 순수한 자바스크립트 코드 텍스트만 반환할 것.
    4. 주석은 달지 말고, 코드만 반환할 것.
    """


def clean_k6_script(script_text: str) -> str:
    return (
        script_text.replace("```javascript", "")
        .replace("```js", "")
        .replace("```", "")
        .strip()
    )


async def generate_k6_script(client, target_url: str, vusers: int, duration: int, load_prompt: str) -> str:
    try:
        system_prompt = build_k6_system_prompt(target_url, vusers, duration, load_prompt)
        response = await client.aio.models.generate_content(
            model="gemini-3.5-flash",
            contents=system_prompt,
        )
        generated_script = response.text.strip() if response.text is not None else ""
        return clean_k6_script(generated_script)
    except Exception as exc:
        raise LoadTestGenerationError("LLM으로부터 k6 스크립트를 생성하지 못했습니다.") from exc


async def publish_progress(request_id: Optional[str], payload: LoadTestProgressUpdate) -> None:
    if not request_id:
        return

    callback_token = os.getenv("LOAD_TEST_CALLBACK_TOKEN")
    if not callback_token:
        logger.error("LOAD_TEST_CALLBACK_TOKEN is not configured; progress callback skipped")
        return

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                f"{BACKEND_URL}/api/load-tests/{request_id}/progress",
                headers={"X-Internal-Api-Key": callback_token},
                json=payload.model_dump(),
            )
            response.raise_for_status()
            logger.info(
                "Progress callback delivered: request_id=%s phase=%s progress=%s",
                request_id,
                payload.phase,
                payload.progress,
            )
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "Progress callback rejected: request_id=%s phase=%s status=%s body=%s",
            request_id,
            payload.phase,
            exc.response.status_code,
            exc.response.text[:500],
        )
    except httpx.RequestError:
        logger.exception(
            "Progress callback failed: request_id=%s phase=%s",
            request_id,
            payload.phase,
        )


def extract_metric(metric_data):
    return metric_data.get("values", metric_data)


# def run_k6_script(script_text: str, duration: int) -> dict:
def run_k6_aws_fargate(script_text: str, duration: int, request_id: str) -> dict:
    
    test_id = request_id if request_id else str(uuid.uuid4())
    script_s3_key = f"tasks/{test_id}/script.js"
    result_s3_key = f"tasks/{test_id}/summary.json"

    try:
        # 1. 생성된 k6 스크립트를 S3에 업로드
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=script_s3_key,
            Body=script_text.encode('utf-8')
        )

        # 2. ECS Fargate Task 실행
        response = ecs_client.run_task(
            cluster=ECS_CLUSTER,
            launchType='FARGATE',
            taskDefinition=ECS_TASK_FAMILY,
            networkConfiguration={
                'awsvpcConfiguration': {
                    'subnets': [ECS_SUBNET_ID],
                    'securityGroups': [ECS_SECURITY_GROUP_ID],
                    'assignPublicIp': 'ENABLED' # ECR 이미지 다운로드 및 S3 통신을 위해 필수
                }
            },
            overrides={
                'containerOverrides': [
                    {
                        'name': 'k6-container',
                        'environment': [
                            {'name': 'S3_BUCKET', 'value': S3_BUCKET},
                            {'name': 'TEST_ID', 'value': test_id}
                        ]
                    }
                ]
            }
        )

        # 작업 ARN(고유 식별자) 추출
        task_arn = response['tasks'][0]['taskArn']

        # 3. Fargate Task가 완료될 때까지 대기 (Polling)
        waiter = ecs_client.get_waiter('tasks_stopped')
        waiter.wait(
            cluster=ECS_CLUSTER,
            tasks=[task_arn],
            WaiterConfig={'Delay': 10, 'MaxAttempts': 60} # 10초 간격으로 최대 10분 대기
        )

        # 4. S3에서 생성된 결과 파일 다운로드
        result_obj = s3_client.get_object(Bucket=S3_BUCKET, Key=result_s3_key)
        summary_data = json.loads(result_obj['Body'].read().decode('utf-8'))
    except ClientError as e:
        raise LoadTestExecutionError(f"AWS 리소스(S3, ECS) 접근 중 오류가 발생했습니다: {e}")
    except Exception as e:
        raise LoadTestExecutionError(f"클라우드 부하 테스트 실행 중 알 수 없는 오류가 발생했습니다: {e}")

    metrics = summary_data.get("metrics", {})
    http_reqs = extract_metric(metrics.get("http_reqs", {}))
    http_duration = extract_metric(metrics.get("http_req_duration", {}))
    http_failed = extract_metric(metrics.get("http_req_failed", {}))

    total_count = http_reqs.get("count", 0)
    real_tps = http_reqs.get("rate", 0)
    real_avg_response = http_duration.get("avg", 0)
    real_error_rate_raw = http_failed.get("value", 0)

    is_server_dead = (total_count == 0) or (real_error_rate_raw >= 0.99)
    if is_server_dead:
        real_error_rate = 100.0
    else:
        real_error_rate = real_error_rate_raw * 100

    return {
        "real_tps": real_tps,
        "real_avg_response": real_avg_response,
        "real_error_rate": real_error_rate,
        "is_server_dead": is_server_dead,
        "duration": duration,
    }


def build_chart_points(duration: int, real_tps: float, real_avg_response: float, is_server_dead: bool) -> List[ChartPoint]:
    chart_points: List[ChartPoint] = []
    num_points = min(duration, 15) if duration > 0 else 10
    interval = duration / num_points

    for index in range(num_points + 1):
        current_time_sec = int(index * interval)
        minutes = current_time_sec // 60
        seconds = current_time_sec % 60
        time_label = f"{minutes:02d}:{seconds:02d}"

        if is_server_dead:
            point_tps = 0
            point_avg_res = 0.0
        else:
            progress_weight = 0.5 + (0.5 * (index / num_points))
            point_tps = int(real_tps * progress_weight * random.uniform(0.85, 1.15))
            point_avg_res = round(real_avg_response * progress_weight * random.uniform(0.9, 1.1), 2)

        chart_points.append(
            ChartPoint(
                time=time_label,
                tps=point_tps,
                avgResponse=point_avg_res,
            )
        )

    return chart_points


async def run_load_test_pipeline(client, request) -> TestResultsResponse:
    request_id = getattr(request, "requestId", None)

    await publish_progress(
        request_id,
        LoadTestProgressUpdate(
            status="RUNNING",
            phase="GENERATING_SCRIPT",
            progress=15,
            message="k6 스크립트를 생성하는 중입니다.",
        ),
    )

    generated_script = await generate_k6_script(
        client=client,
        target_url=request.targetUrl,
        vusers=request.vusers,
        duration=request.duration,
        load_prompt=request.loadPrompt or "",
    )

    await publish_progress(
        request_id,
        LoadTestProgressUpdate(
            status="RUNNING",
            phase="PROVISIONING_INFRA",
            progress=35,
            message="클라우드 부하 테스트 인프라를 프로비저닝하고 실행 중입니다. (약 1분 소요)",
        ),
    )

    print("\n========== [Gemini가 생성한 k6 스크립트] ==========")
    print(generated_script)
    print("===================================================\n")

    summary = await asyncio.to_thread(
        run_k6_aws_fargate,
        generated_script,
        request.duration,
        request_id
    )

    await publish_progress(
        request_id,
        LoadTestProgressUpdate(
            status="RUNNING",
            phase="PROCESSING_RESULTS",
            progress=80,
            message="실행 결과를 해석하고 보고서를 작성하는 중입니다.",
        ),
    )

    chart_points = build_chart_points(
        duration=request.duration,
        real_tps=summary["real_tps"],
        real_avg_response=summary["real_avg_response"],
        is_server_dead=summary["is_server_dead"],
    )

    assessment = calculate_performance_assessment(summary)
    analysis = await generate_analysis_report(
        client=client,
        summary=summary,
        assessment=assessment,
        target_url=request.targetUrl,
        vusers=request.vusers,
        duration=request.duration,
        load_prompt=request.loadPrompt or "",
    )
    markdown_report = build_markdown_report(summary, assessment, analysis)

    await publish_progress(
        getattr(request, "requestId", None),
        LoadTestProgressUpdate(
            status="RUNNING",
            phase="RESULT_READY",
            progress=95,
            message="결과를 전달할 준비가 되었습니다.",
        ),
    )

    return TestResultsResponse(
        maxTps=int(summary["real_tps"]),
        avgResponse=round(summary["real_avg_response"], 2),
        errorRate=round(summary["real_error_rate"], 2),
        performanceScore=assessment.score,
        performanceGrade=assessment.grade,
        scoreLabel=assessment.label,
        scoreBreakdown=assessment.breakdown,
        bottleneckComment=markdown_report,
        points=chart_points,
    )
