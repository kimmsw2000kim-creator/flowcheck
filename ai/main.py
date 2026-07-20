import truststore
truststore.inject_into_ssl()

from fastapi import FastAPI, BackgroundTasks, Depends, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from uiux_test_service import run_uiux_test_service
from chatbot_service import generate_chat_response
import os
import hmac
from dotenv import load_dotenv
from google import genai

from load_test_service import (
    LoadTestExecutionError,
    LoadTestGenerationError,
    TargetUnavailableError,
    TestResultsResponse,
    run_load_test_pipeline,
)
from load_test.models import PerformanceTargets

class UiTestRequest(BaseModel):
    """Spring 백엔드가 UI/UX 테스트 실행을 요청할 때 보내는 payload입니다.

    requestId는 이후 워커가 Spring의 steps/report/fail API로 콜백할 때 쓰는 기준 ID이고,
    targetUrl은 Playwright/Lighthouse가 실제로 접속할 검사 대상입니다.
    """
    requestId: str
    targetUrl: str
    promptInput: Optional[str] = ""

class ChatRequest(BaseModel):
    message: str

ENV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(ENV_PATH)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
LOAD_TEST_CALLBACK_TOKEN = os.getenv("LOAD_TEST_CALLBACK_TOKEN")
INTERNAL_API_KEY = os.getenv("FASTAPI_INTERNAL_API_KEY") or LOAD_TEST_CALLBACK_TOKEN

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY가 .env 파일에 설정되지 않았습니다.")

if not LOAD_TEST_CALLBACK_TOKEN:
    raise ValueError("LOAD_TEST_CALLBACK_TOKEN이 설정되지 않았습니다.")

if not INTERNAL_API_KEY:
    raise ValueError("FASTAPI_INTERNAL_API_KEY 또는 LOAD_TEST_CALLBACK_TOKEN이 설정되지 않았습니다.")

client = genai.Client(api_key=GEMINI_API_KEY)

app = FastAPI()

cors_origins = [
    origin.strip()
    for origin in os.getenv("FASTAPI_CORS_ORIGINS", "http://localhost:5173,https://flowcheck.kr").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoadTestRequest(BaseModel):
    requestId: Optional[str] = None
    targetUrl: str
    vusers: int
    duration: int
    loadPrompt: Optional[str] = ""
    performanceTargets: Optional[PerformanceTargets] = None

def require_internal_api_key(x_internal_api_key: Optional[str] = Header(default=None)) -> None:
    if not x_internal_api_key or not hmac.compare_digest(x_internal_api_key, INTERNAL_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid internal API key")

@app.post("/api/load-tests", response_model=TestResultsResponse)
async def run_load_test(request: LoadTestRequest):
    print(f"Spring Boot로부터 부하 테스트 요청 수신: {request.targetUrl}, vusers={request.vusers}", flush=True)
    try:
        print("부하 테스트 파이프라인 시작...", flush=True)
        result = await run_load_test_pipeline(client, request)
    except TargetUnavailableError as e:
        print(f"타겟 서버 사전 확인 실패: {e}", flush=True)
        raise HTTPException(status_code=424, detail=str(e)) from e
    except (LoadTestGenerationError, LoadTestExecutionError) as e:
        print(f"부하 테스트 처리 중 오류 발생: {e}", flush=True)
        raise RuntimeError(str(e))

    print("테스트 완료! 정리된 결과를 반환합니다.", flush=True)
    return result

@app.post("/api/uiux-tests", dependencies=[Depends(require_internal_api_key)])
async def run_uiux_test(request: UiTestRequest, background_tasks: BackgroundTasks):
    # UI/UX 테스트는 브라우저/컨테이너 실행이 오래 걸리므로 FastAPI 요청 안에서 직접 기다리지 않습니다.
    # background task로 넘기고 즉시 accepted 성격의 응답을 주면 Spring의 AsyncUIUXTestWorker가 빠르게 반환됩니다.
    print(f"UIUX 테스트 요청 수신됨: {request}", flush=True)
    background_tasks.add_task(run_uiux_test_service, request.requestId, request.targetUrl)
    return {"status": "started"}

@app.post("/api/chat", dependencies=[Depends(require_internal_api_key)])
async def chat_endpoint(request: ChatRequest):
    print(f"챗봇 메시지 수신: {request.message[:20]}...", flush=True)
    response_text = generate_chat_response(request.message, client)
    return {"response": response_text}
