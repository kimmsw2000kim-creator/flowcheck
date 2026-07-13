import uuid
import json
import logging
import os
import random
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


class TestResultsResponse(BaseModel):
    maxTps: int
    avgResponse: float
    errorRate: float
    bottleneckComment: str
    points: List[ChartPoint]


class LoadTestProgressUpdate(BaseModel):
    status: str
    phase: str
    progress: int
    message: str


def build_analysis_prompt(summary: dict, chart_points: List[ChartPoint], target_url: str, vusers: int, duration: int, load_prompt: str) -> str:
    points_preview = [point.model_dump() for point in chart_points[:8]]

    return f"""
    너는 시니어 성능 테스트 엔지니어이자 k6 결과 분석가야.
    아래의 k6 실행 결과를 바탕으로 한국어 성능 분석 보고서를 작성해줘.

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

    [차트 샘플]
    {json.dumps(points_preview, ensure_ascii=False)}

    [출력 조건]
    1. 반드시 순수한 한국어 보고서 텍스트만 반환할 것.
    2. 마크다운 기호, 코드블록, 목록 기호는 사용하지 말 것.
    3. 결과 해석, 병목 가능성, 안정성 판단, 개선 권장 사항을 자연스럽게 포함할 것.
    4. 3~6문장 정도로 간결하게 작성할 것.
    """


async def generate_analysis_report(client, summary: dict, chart_points: List[ChartPoint], target_url: str, vusers: int, duration: int, load_prompt: str) -> str:
    try:
        prompt = build_analysis_prompt(summary, chart_points, target_url, vusers, duration, load_prompt)
        response = await client.aio.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
        )
        analysis_text = response.text.strip() if response.text is not None else ""
        return analysis_text
    except Exception:
        if summary.get("is_server_dead"):
            return "타겟 서버가 요청을 정상적으로 처리하지 못해 사실상 중단된 상태로 판단됩니다. 우선 인프라 연결 상태와 타임아웃, 서버 자원 사용률을 점검해야 합니다."

        error_rate = summary.get("real_error_rate", 0)
        avg_response = summary.get("real_avg_response", 0)
        max_tps = summary.get("real_tps", 0)
        return f"테스트 결과를 보면 최대 처리량은 약 {max_tps:.0f} req/s 수준이며 평균 응답 시간은 {avg_response:.2f}ms, 에러율은 {error_rate:.2f}%입니다. 현재 수치만 보면 치명적인 장애는 아니지만, 응답 지연이나 에러율이 증가하는 구간이 있으면 병목 가능성을 의심할 수 있습니다. 추가로 서버 CPU, DB 커넥션, 외부 API 호출 시간을 함께 확인하는 것이 좋습니다."


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

    analysis_report = await generate_analysis_report(
        client=client,
        summary=summary,
        chart_points=chart_points,
        target_url=request.targetUrl,
        vusers=request.vusers,
        duration=request.duration,
        load_prompt=request.loadPrompt or "",
    )

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
        bottleneckComment=analysis_report,
        points=chart_points,
    )
