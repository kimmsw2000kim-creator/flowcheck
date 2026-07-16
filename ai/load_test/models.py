from typing import List

from pydantic import BaseModel


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
