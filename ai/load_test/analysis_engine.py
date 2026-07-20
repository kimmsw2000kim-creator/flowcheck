from __future__ import annotations

from collections import defaultdict
from typing import Any, Iterable, Literal, Optional

from pydantic import BaseModel, Field


class StageAnalysis(BaseModel):
    stage: str
    startSecond: int
    endSecond: int
    minVus: int
    maxVus: int
    avgVus: float
    requestCount: int
    avgTps: float
    maxTps: int
    tpsPerVu: float
    avgResponse: Optional[float] = None
    p95Response: Optional[float] = None
    errorRate: Optional[float] = None


class BottleneckSignal(BaseModel):
    type: str
    severity: str
    firstObservedSecond: Optional[int] = None
    evidence: str


class LoadAnalysisContext(BaseModel):
    stages: list[StageAnalysis] = Field(default_factory=list)
    bottlenecks: list[BottleneckSignal] = Field(default_factory=list)
    coverageRatio: float = 0.0
    scalingEfficiency: Optional[float] = None
    diagnosticMetrics: Optional[dict[str, Any]] = None


class AnalysisAction(BaseModel):
    priority: int = Field(ge=1, le=3)
    title: str = Field(min_length=1, max_length=120)
    rationale: str = Field(min_length=1, max_length=500)
    evidence: str = Field(min_length=1, max_length=500)


class StructuredAnalysisReport(BaseModel):
    schemaVersion: int = 1
    generationSource: Literal["LLM", "FALLBACK_INVALID", "FALLBACK_ERROR"]
    verdict: str = Field(min_length=1, max_length=500)
    stages: list[StageAnalysis] = Field(default_factory=list)
    bottlenecks: list[BottleneckSignal] = Field(default_factory=list)
    actions: list[AnalysisAction] = Field(default_factory=list, max_length=3)
    limitations: list[str] = Field(default_factory=list, max_length=3)
    sustainableTps: Optional[float] = None


def build_analysis_context(
    summary: dict[str, Any],
    declared_profile: Optional[list[dict[str, Any]]] = None,
) -> LoadAnalysisContext:
    diagnostics = summary.get("diagnostic_metrics")
    if hasattr(diagnostics, "model_dump"):
        diagnostics = diagnostics.model_dump()
    diagnostic_dict = diagnostics if isinstance(diagnostics, dict) else None
    points = [_point_to_dict(point) for point in summary.get("chart_points", [])]
    if not points:
        return LoadAnalysisContext(
            bottlenecks=(
                _detect_diagnostic_bottlenecks(diagnostic_dict)
                if diagnostic_dict
                else []
            ),
            diagnosticMetrics=diagnostic_dict,
        )

    grouped = (
        _group_by_declared_profile(points, declared_profile)
        if declared_profile
        else _group_by_observed_load(points)
    )
    stages = [
        _summarize_stage(stage, stage_points)
        for stage, stage_points in grouped.items()
        if stage_points
    ]
    coverage = sum(_is_complete_point(point) for point in points) / len(points)
    bottlenecks, scaling_efficiency = _detect_bottlenecks(stages, points)
    if diagnostic_dict:
        bottlenecks.extend(_detect_diagnostic_bottlenecks(diagnostic_dict))

    return LoadAnalysisContext(
        stages=stages,
        bottlenecks=bottlenecks,
        coverageRatio=round(coverage, 4),
        scalingEfficiency=(
            round(scaling_efficiency, 4)
            if scaling_efficiency is not None
            else None
        ),
        diagnosticMetrics=diagnostic_dict,
    )


def _point_to_dict(point: Any) -> dict[str, Any]:
    if hasattr(point, "model_dump"):
        return point.model_dump()
    if isinstance(point, dict):
        return point
    return vars(point)


def _group_by_declared_profile(
    points: list[dict[str, Any]],
    profile: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    boundaries: list[tuple[str, float]] = []
    cumulative_seconds = 0.0
    for index, stage in enumerate(profile, start=1):
        cumulative_seconds += _duration_seconds(stage.get("duration"))
        target = int(stage.get("target", 0))
        boundaries.append((f"STAGE_{index}_TARGET_{target}", cumulative_seconds))

    grouped: dict[str, list[dict[str, Any]]] = {label: [] for label, _ in boundaries}
    for point in points:
        elapsed = float(point.get("elapsedSeconds") or 0)
        selected = boundaries[-1][0]
        for label, boundary in boundaries:
            if elapsed < boundary:
                selected = label
                break
        grouped[selected].append(point)
    return grouped


def _group_by_observed_load(
    points: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    maximum_vus = max(int(point.get("vus") or 0) for point in points)
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    previous_vus = 0

    for point in points:
        vus = int(point.get("vus") or 0)
        if vus < previous_vus:
            stage = "RAMP_DOWN"
        elif maximum_vus <= 0 or vus / maximum_vus <= 0.33:
            stage = "LOW_LOAD"
        elif vus / maximum_vus <= 0.66:
            stage = "MEDIUM_LOAD"
        else:
            stage = "HIGH_LOAD"
        grouped[stage].append(point)
        previous_vus = vus

    return dict(grouped)


def _summarize_stage(stage: str, points: list[dict[str, Any]]) -> StageAnalysis:
    tps_values = [max(0, int(point.get("tps") or 0)) for point in points]
    vus_values = [max(0, int(point.get("vus") or 0)) for point in points]
    request_count = sum(tps_values)
    avg_tps = sum(tps_values) / len(points)
    avg_vus = sum(vus_values) / len(points)

    return StageAnalysis(
        stage=stage,
        startSecond=int(points[0].get("elapsedSeconds") or 0),
        endSecond=int(points[-1].get("elapsedSeconds") or 0),
        minVus=min(vus_values),
        maxVus=max(vus_values),
        avgVus=round(avg_vus, 2),
        requestCount=request_count,
        avgTps=round(avg_tps, 2),
        maxTps=max(tps_values),
        tpsPerVu=round(avg_tps / avg_vus, 4) if avg_vus > 0 else 0.0,
        avgResponse=_weighted_average(points, "avgResponse", tps_values),
        p95Response=_maximum(points, "p95Response"),
        errorRate=_weighted_average(points, "errorRate", tps_values),
    )


def _weighted_average(
    points: list[dict[str, Any]],
    field: str,
    weights: list[int],
) -> Optional[float]:
    samples = [
        (float(point[field]), max(1, weight))
        for point, weight in zip(points, weights)
        if point.get(field) is not None
    ]
    if not samples:
        return None
    total_weight = sum(weight for _, weight in samples)
    return round(sum(value * weight for value, weight in samples) / total_weight, 2)


def _maximum(points: Iterable[dict[str, Any]], field: str) -> Optional[float]:
    values = [float(point[field]) for point in points if point.get(field) is not None]
    return round(max(values), 2) if values else None


def _is_complete_point(point: dict[str, Any]) -> bool:
    return all(
        point.get(field) is not None
        for field in ("avgResponse", "p95Response", "errorRate", "vus")
    )


def _detect_bottlenecks(
    stages: list[StageAnalysis],
    points: list[dict[str, Any]],
) -> tuple[list[BottleneckSignal], Optional[float]]:
    signals: list[BottleneckSignal] = []
    comparable = [
        stage
        for stage in stages
        if stage.stage != "RAMP_DOWN"
        and not stage.stage.endswith("_TARGET_0")
        and stage.avgVus > 0
    ]
    scaling_efficiency: Optional[float] = None

    if len(comparable) >= 2:
        high = max(comparable, key=lambda stage: stage.avgVus)
        lower_load_stages = [
            stage
            for stage in comparable
            if stage is not high and stage.avgVus <= high.avgVus * 0.85
        ]
        medium = (
            max(lower_load_stages, key=lambda stage: stage.avgVus)
            if lower_load_stages
            else min(comparable, key=lambda stage: stage.avgVus)
        )
        vu_ratio = high.avgVus / medium.avgVus if medium.avgVus else 0
        tps_ratio = high.avgTps / medium.avgTps if medium.avgTps else 0
        if vu_ratio > 0:
            scaling_efficiency = min(1.0, max(0.0, tps_ratio / vu_ratio))

        if scaling_efficiency is not None and scaling_efficiency < 0.7:
            signals.append(
                BottleneckSignal(
                    type="THROUGHPUT_SATURATION",
                    severity="HIGH" if scaling_efficiency < 0.4 else "MEDIUM",
                    firstObservedSecond=high.startSecond,
                    evidence=(
                        f"VU가 {medium.avgVus:.2f}에서 {high.avgVus:.2f}로 증가했지만 "
                        f"평균 TPS는 {medium.avgTps:.2f}에서 {high.avgTps:.2f}로 변화해 "
                        f"확장 효율이 {scaling_efficiency * 100:.1f}%입니다."
                    ),
                )
            )

        if (
            medium.p95Response is not None
            and high.p95Response is not None
            and high.p95Response > medium.p95Response * 1.5
            and high.p95Response - medium.p95Response >= 100
        ):
            signals.append(
                BottleneckSignal(
                    type="TAIL_LATENCY_DEGRADATION",
                    severity="HIGH" if high.p95Response >= medium.p95Response * 2 else "MEDIUM",
                    firstObservedSecond=high.startSecond,
                    evidence=(
                        f"p95 응답시간이 {medium.p95Response:.2f}ms에서 "
                        f"{high.p95Response:.2f}ms로 증가했습니다."
                    ),
                )
            )

    error_point = next(
        (point for point in points if float(point.get("errorRate") or 0) > 1.0),
        None,
    )
    if error_point is not None:
        signals.append(
            BottleneckSignal(
                type="ERROR_RATE_INCREASE",
                severity="HIGH" if float(error_point.get("errorRate") or 0) >= 5 else "MEDIUM",
                firstObservedSecond=int(error_point.get("elapsedSeconds") or 0),
                evidence=(
                    f"{int(error_point.get('elapsedSeconds') or 0)}초 구간에서 "
                    f"오류율 {float(error_point.get('errorRate') or 0):.2f}%가 관측됐습니다."
                ),
            )
        )

    return signals, scaling_efficiency


def _duration_seconds(value: Any) -> float:
    text = str(value or "0ms").strip().lower()
    if text.endswith("ms"):
        return float(text[:-2]) / 1000
    if text.endswith("s"):
        return float(text[:-1])
    return float(text)


def _detect_diagnostic_bottlenecks(
    diagnostics: dict[str, Any],
) -> list[BottleneckSignal]:
    signals: list[BottleneckSignal] = []
    dropped = max(0, int(diagnostics.get("droppedIterations") or 0))
    if dropped > 0:
        signals.append(BottleneckSignal(
            type="DROPPED_ITERATIONS",
            severity="HIGH",
            evidence=f"실행 중 dropped iterations {dropped}건이 관측됐습니다.",
        ))
    check_failure_rate = diagnostics.get("checkFailureRate")
    if check_failure_rate is not None and float(check_failure_rate) > 0:
        signals.append(BottleneckSignal(
            type="CHECK_FAILURES",
            severity="HIGH" if float(check_failure_rate) >= 5 else "MEDIUM",
            evidence=f"k6 check 실패율이 {float(check_failure_rate):.2f}%입니다.",
        ))
    threshold_failures = diagnostics.get("thresholdFailures") or []
    if threshold_failures:
        signals.append(BottleneckSignal(
            type="THRESHOLD_FAILURES",
            severity="HIGH",
            evidence=f"k6 threshold {len(threshold_failures)}개가 실패했습니다.",
        ))
    return signals
