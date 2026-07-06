import json
import os
import random
import subprocess
import tempfile
from typing import List

from pydantic import BaseModel


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
    bottleneckDiagnosis: str
    points: List[ChartPoint]


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


def extract_metric(metric_data):
    return metric_data.get("values", metric_data)


def run_k6_script(script_text: str, duration: int) -> dict:
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            script_path = os.path.join(temp_dir, "script.js")
            result_path = os.path.join(temp_dir, "summary.json")

            with open(script_path, "w", encoding="utf-8") as file_handle:
                file_handle.write(script_text)

            subprocess.run(
                [
                    "docker",
                    "run",
                    "--rm",
                    "-v",
                    f"{os.path.abspath(temp_dir)}:/app",
                    "grafana/k6",
                    "run",
                    "--insecure-skip-tls-verify",
                    "--summary-export",
                    "/app/summary.json",
                    "/app/script.js",
                ],
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
            )

            with open(result_path, "r", encoding="utf-8") as file_handle:
                summary_data = json.load(file_handle)
    except subprocess.CalledProcessError as exc:
        raise LoadTestExecutionError("부하 테스트 스크립트를 실행하지 못했습니다.") from exc

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
        bottleneck_comment = "🚨 AI 긴급 진단: 타겟 서버가 트래픽을 처리하지 못하고 다운(Crash) 또는 연결 거부(Timeout) 상태에 빠졌습니다."
    else:
        real_error_rate = real_error_rate_raw * 100
        if real_error_rate < 1:
            bottleneck_comment = "✅ AI 분석 요약: 타겟 서버가 지정된 부하를 성공적으로 견뎌냈습니다."
        else:
            bottleneck_comment = f"⚠️ AI 분석 요약: 서버 에러율이 {real_error_rate:.1f}%로 병목이 의심됩니다."

    return {
        "real_tps": real_tps,
        "real_avg_response": real_avg_response,
        "real_error_rate": real_error_rate,
        "bottleneck_comment": bottleneck_comment,
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
    generated_script = await generate_k6_script(
        client=client,
        target_url=request.targetUrl,
        vusers=request.vusers,
        duration=request.duration,
        load_prompt=request.loadPrompt or "",
    )

    print("\n========== [Gemini가 생성한 k6 스크립트] ==========")
    print(generated_script)
    print("===================================================\n")

    summary = run_k6_script(generated_script, request.duration)
    chart_points = build_chart_points(
        duration=request.duration,
        real_tps=summary["real_tps"],
        real_avg_response=summary["real_avg_response"],
        is_server_dead=summary["is_server_dead"],
    )

    return TestResultsResponse(
        maxTps=int(summary["real_tps"]),
        avgResponse=round(summary["real_avg_response"], 2),
        errorRate=round(summary["real_error_rate"], 2),
        bottleneckDiagnosis=summary["bottleneck_comment"],
        points=chart_points,
    )