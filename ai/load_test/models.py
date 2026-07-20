from typing import List, Optional

from pydantic import BaseModel


class ChartPoint(BaseModel):
    time: str
    elapsedSeconds: Optional[int] = None
    tps: int
    avgResponse: Optional[float] = None
    p95Response: Optional[float] = None
    errorRate: Optional[float] = None
    vus: Optional[int] = None


class ScoreBreakdown(BaseModel):
    reliabilityScore: int
    latencyScore: int


class PerformanceAssessment(BaseModel):
    score: int
    grade: str
    label: str
    breakdown: ScoreBreakdown


class TestResultsResponse(BaseModel):
    avgTps: float
    maxTps: Optional[int] = None
    avgResponse: float
    p95Response: Optional[float] = None
    errorRate: float
    performanceScore: int
    performanceGrade: str
    scoreLabel: str
    scoreBreakdown: ScoreBreakdown
    bottleneckComment: str
    points: List[ChartPoint]
    metricsStatus: str
    metricsWarning: Optional[str] = None
    dataOrigin: str


class LoadTestProgressUpdate(BaseModel):
    status: str
    phase: str
    progress: int
    message: str
