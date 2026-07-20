from typing import List, Optional

from pydantic import BaseModel, Field

from .analysis_engine import StructuredAnalysisReport


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
    scalabilityScore: Optional[int] = None


class PerformanceTargets(BaseModel):
    targetTps: Optional[float] = Field(default=None, gt=0)
    targetP95Ms: float = Field(default=500.0, gt=0)
    maxErrorRate: float = Field(default=1.0, ge=0, le=100)


class PerformanceAssessment(BaseModel):
    score: int
    grade: str
    label: str
    breakdown: ScoreBreakdown


class PerformanceScoreResult(BaseModel):
    assessment: PerformanceAssessment
    version: int
    status: str
    targets: PerformanceTargets
    sustainableTps: Optional[float] = None


class TestResultsResponse(BaseModel):
    totalRequests: int
    avgTps: float
    maxTps: Optional[int] = None
    avgResponse: float
    p95Response: Optional[float] = None
    errorRate: float
    performanceScore: int
    performanceGrade: str
    scoreLabel: str
    scoreBreakdown: ScoreBreakdown
    scoreVersion: int = 1
    scoreStatus: str = "LEGACY_V1"
    scoreTargets: Optional[PerformanceTargets] = None
    bottleneckComment: str
    analysisReport: Optional[StructuredAnalysisReport] = None
    points: List[ChartPoint]
    metricsStatus: str
    metricsWarning: Optional[str] = None
    dataOrigin: str
    bucketSeconds: Optional[int] = None


class LoadTestProgressUpdate(BaseModel):
    status: str
    phase: str
    progress: int
    message: str
