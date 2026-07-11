import truststore
truststore.inject_into_ssl()

from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from UIUX_test_service import run_UIUX_test_service
import os
from dotenv import load_dotenv
from google import genai

from load_test_service import (
    LoadTestExecutionError,
    LoadTestGenerationError,
    TestResultsResponse,
    run_load_test_pipeline,
)

class UiTestRequest(BaseModel):
    requestId: str
    targetUrl: str

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
        "__file__": __file__,
    }

class LoadTestRequest(BaseModel):
    requestId: Optional[str] = None
    targetUrl: str
    vusers: int
    duration: int
    loadPrompt: Optional[str] = ""

@app.post("/api/load-tests", response_model=TestResultsResponse)
async def run_load_test(request: LoadTestRequest):
    print(f"Spring Boot로부터 요청 수신: {request.targetUrl}, vusers={request.vusers}")
    try:
        print("Gemini API 호출 중... (k6 스크립트 생성)")
        result = await run_load_test_pipeline(client, request)
    except (LoadTestGenerationError, LoadTestExecutionError) as e:
        print(f"부하 테스트 처리 중 오류 발생: {e}")
        raise RuntimeError(str(e))

    print("테스트 완료! 정밀 결과를 반환합니다.")
    return result

@app.post("/api/ui-tests")
async def run_ui_test(request: UiTestRequest, background_tasks: BackgroundTasks):
    print(f"UI 테스트 요청 수신됨: {request}")
    background_tasks.add_task(run_UIUX_test_service, request.requestId, request.targetUrl)
    return {"status": "started"}