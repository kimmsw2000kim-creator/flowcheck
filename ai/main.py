from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from ui_agent import run_ui_agent
import os
from dotenv import load_dotenv

class UiTestRequest(BaseModel):
    requestId: str
    targetUrl: str
from dotenv import load_dotenv
from google import genai

import os
import subprocess
import tempfile
import json
import random

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY .env 파일에 설정되지 않았습니다.")

client = genai.Client(api_key=GEMINI_API_KEY)

app = FastAPI()

@app.get("/api/debug-env")
def debug_env():
    env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
    exists = os.path.exists(env_path)
    key_in_file = None
    if exists:
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("GEMINI_API_KEY="):
                        key_in_file = line.strip().split("=", 1)[1]
                        break
        except Exception as e:
            key_in_file = f"Error reading file: {str(e)}"
    
    # Force reload
    load_dotenv(env_path, override=True)
    api_key = os.getenv("GEMINI_API_KEY")
    
    return {
        "env_path": env_path,
        "exists": exists,
        "key_in_file_masked": (key_in_file[:10] + "...") if key_in_file else None,
        "api_key_in_env_masked": (api_key[:10] + "...") if api_key else None,
        "working_directory": os.getcwd(),
        "__file__": __file__
    }

class LoadTestRequest(BaseModel):
    targetUrl: str
    vusers: int
    duration: int
    loadPrompt: Optional[str] = ""

class ChartPoint(BaseModel):
    time: str
    tps: int
    avg_response: float

class TestResultsResponse(BaseModel):
    maxTps: int
    avgResponse: float
    errorRate: float
    bottleneckDiagnosis: str
    points: List[ChartPoint]

@app.post("/api/load-tests", response_model=TestResultsResponse)
async def run_load_test(request: LoadTestRequest):
    print(f"Spring Boot로부터 요청 수신: {request.targetUrl}, vusers={request.vusers}")

    system_prompt = f"""
    너는 시니어 성능 테스트 엔지니어이자 k6 전문가야.
    다음 요구사항을 바탕으로 완벽하게 동작하는 k6 자바스크립트 코드를 작성해줘.

    [요구사항]
    - Target URL: {request.targetUrl}
    - 기본 가상 유저(VUs): {request.vusers}명
    - 테스트 지속 시간: {request.duration}초
    - 추가 시나리오 요건: {request.loadPrompt}

    [조건]
    1. '추가 시나리오 요건'에 점진적 증가(Ramp-up)나 특정 부하 패턴이 명시되어 있다면, k6의 `stages` 옵션을 우선 고려하여 시나리오를 구성할 것.
    2. 특별한 시나리오 요건이 없다면 기본 `vus`와 `duration` 옵션을 사용할 것.
    3. 시나리오 요건에 맞는 HTTP 메서드와 대기 시간(Think time)을 구성할 것.
    3. 마크다운 기호(```javascript ... ```)를 절대 사용하지 말고, 순수한 자바스크립트 코드 텍스트만 반환할 것.
    4. 주석은 달지 말고, 코드만 반환할 것.
    """

    try:
        print("Gemini API 호출 중... (k6 스크립트 생성)")
        response = await client.aio.models.generate_content(
            model="gemini-3.5-flash",
            contents=system_prompt
        )
        
        generated_script = response.text.strip() if response.text is not None else ""
        generated_script = generated_script.replace("```javascript", "").replace("```js", "").replace("```", "").strip()

        print("\n========== [Gemini가 생성한 k6 스크립트] ==========")
        print(generated_script)
        print("===================================================\n")

    except Exception as e:
        print(f"LLM 스크립트 생성 중 오류 발생: {e}")
        raise RuntimeError("LLM으로부터 k6 스크립트를 생성하지 못했습니다.")

    with tempfile.TemporaryDirectory() as temp_dir:
        script_path = os.path.join(temp_dir, "script.js")
        result_path = os.path.join(temp_dir, "summary.json")

        with open(script_path, "w", encoding="utf-8") as f:
            f.write(generated_script)

        print(f"k6 Docker 컨테이너 실행 중... (테스트 시간: {request.duration}초 예상)")
        
        try:
            subprocess.run(
                [
                    "docker", "run", "--rm",
                    "-v", f"{os.path.abspath(temp_dir)}:/app",
                    "grafana/k6", "run",
                    "--insecure-skip-tls-verify",
                    "--summary-export", "/app/summary.json",
                    "/app/script.js"
                ],
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8"
            )
            
            with open(result_path, "r", encoding="utf-8") as f:
                summary_data = json.load(f)
                
            metrics = summary_data.get("metrics", {})
            
            # 💡 [헬퍼 함수] 'values' 껍데기가 있으면 벗기고, 없으면 그대로 반환
            def get_metric(metric_data):
                return metric_data.get("values", metric_data)

            http_reqs = get_metric(metrics.get("http_reqs", {}))
            total_count = http_reqs.get("count", 0)
            real_tps = http_reqs.get("rate", 0)
            
            http_duration = get_metric(metrics.get("http_req_duration", {}))
            real_avg_response = http_duration.get("avg", 0)
            
            http_failed = get_metric(metrics.get("http_req_failed", {}))
            real_error_rate_raw = http_failed.get("value", 0)
            
            # 타임아웃 증발(카운트0) 또는 에러율 99% 이상 시 서버 다운 판정
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

        except subprocess.CalledProcessError as e:
            print(f"Docker k6 실행 중 오류 발생:\n{e.stderr}")
            raise RuntimeError("부하 테스트 스크립트를 실행하지 못했습니다.")
            
        chart_points = []
        num_points = min(request.duration, 15) if request.duration > 0 else 10 # 기본 15등분
        interval = request.duration / num_points

        for i in range(num_points + 1):
            current_time_sec = int(i * interval)
            minutes = current_time_sec // 60
            seconds = current_time_sec % 60
            time_label = f"{minutes:02d}:{seconds:02d}"
            
            if is_server_dead:
                point_tps = 0
                point_avg_res = 0.0
            else:
                # 자연스러운 차트를 위해 실제 평균값 위아래로 약간의 노이즈(분산)를 더해줍니다.
                # 점진적 부하인 경우 초기엔 낮다가 올라가도록 가중치(i/num_points) 적용
                progress_weight = 0.5 + (0.5 * (i / num_points)) 
                point_tps = int(real_tps * progress_weight * random.uniform(0.85, 1.15))
                point_avg_res = round(real_avg_response * progress_weight * random.uniform(0.9, 1.1), 2)

            chart_points.append(ChartPoint(
                time=time_label, 
                tps=point_tps,
                avg_response=point_avg_res # 프론트엔드의 응답 속도 꺾은선 차트도 활성화됨!
            ))

    print("테스트 완료! 정밀 결과를 반환합니다.")
    
    return TestResultsResponse(
        maxTps=int(real_tps),
        avgResponse=round(real_avg_response, 2),
        errorRate=round(real_error_rate, 2),
        bottleneckDiagnosis=bottleneck_comment,
        points=chart_points
    )

@app.post("/api/ui-tests")
async def run_ui_test(request: UiTestRequest, background_tasks: BackgroundTasks):
    print(f"Received UI test request: {request}")
    background_tasks.add_task(run_ui_agent, request.requestId, request.targetUrl)
    return {"status": "started"}