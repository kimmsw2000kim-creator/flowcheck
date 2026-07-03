from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from ui_agent import run_ui_agent

class UiTestRequest(BaseModel):
    requestId: str
    targetUrl: str

app = FastAPI()

class LoadTestRequest(BaseModel):
    targetUrl: str
    vusers: int
    duration: int
    loadPrompt: Optional[str] = ""

class ChartPoint(BaseModel):
    time: str
    tps: int

class TestResultsResponse(BaseModel):
    maxTps: int
    avgResponse: float
    errorRate: float
    bottleneckDiagnosis: str
    points: List[ChartPoint]

@app.post("/api/load-tests", response_model=TestResultsResponse)
async def run_load_test_mock(request: LoadTestRequest):
    print(f"Spring Boot로부터 요청 수신: {request}")
    
    # 여기서 LLM 호출 및 k6 실행이 일어난다고 가정 (현재는 3초 대기 Mock)
    import asyncio
    await asyncio.sleep(3)

    return TestResultsResponse(
        maxTps=1200,
        avgResponse=0.45,
        errorRate=0.01,
        bottleneckDiagnosis="No major bottlenecks detected. (From FastAPI Mock)",
        points=[
            ChartPoint(time="10:00", tps=500),
            ChartPoint(time="10:01", tps=1200)
        ]
    )

@app.post("/api/ui-tests")
async def run_ui_test(request: UiTestRequest, background_tasks: BackgroundTasks):
    print(f"Received UI test request: {request}")
    background_tasks.add_task(run_ui_agent, request.requestId, request.targetUrl)
    return {"status": "started"}