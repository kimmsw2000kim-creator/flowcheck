import truststore
truststore.inject_into_ssl()

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from uiux_test_service import run_uiux_test_service
from chatbot_service import generate_chat_response
import os
from dotenv import load_dotenv
from google import genai

from load_test_service import (
    LoadTestExecutionError,
    LoadTestGenerationError,
    TargetUnavailableError,
    TestResultsResponse,
    run_load_test_pipeline,
)

class UiTestRequest(BaseModel):
    requestId: str
    targetUrl: str
    promptInput: Optional[str] = ""

class ChatRequest(BaseModel):
    message: str

ENV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(ENV_PATH)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
LOAD_TEST_CALLBACK_TOKEN = os.getenv("LOAD_TEST_CALLBACK_TOKEN")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY가 .env 파일에 설정되지 않았습니다.")

if not LOAD_TEST_CALLBACK_TOKEN:
    raise ValueError("LOAD_TEST_CALLBACK_TOKEN이 설정되지 않았습니다.")

client = genai.Client(api_key=GEMINI_API_KEY)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/debug-env")
def debug_env():
    env_path = ENV_PATH
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

@app.post("/api/uiux-tests")
async def run_uiux_test(request: UiTestRequest, background_tasks: BackgroundTasks):
    print(f"UIUX 테스트 요청 수신됨: {request}", flush=True)
    background_tasks.add_task(run_uiux_test_service, request.requestId, request.targetUrl)
    return {"status": "started"}

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    print(f"챗봇 메시지 수신: {request.message[:20]}...", flush=True)
    response_text = generate_chat_response(request.message, client)
    return {"response": response_text}
