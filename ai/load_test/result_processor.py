import math
from typing import Any, Dict, Optional

from .analysis_engine import LoadAnalysisContext
from .models import (
    PerformanceAssessment,
    PerformanceScoreResult,
    PerformanceTargets,
    ScoreBreakdown,
)

LoadTestSummary = Dict[str, Any]


def extract_metric(metric_data: Dict[str, Any]) -> Dict[str, Any]:
    return metric_data.get("values", metric_data)


def parse_k6_summary(summary_data: Dict[str, Any], duration: int) -> LoadTestSummary:
    metrics = summary_data.get("metrics", {})
    http_reqs = extract_metric(metrics.get("http_reqs", {}))
    http_duration = extract_metric(metrics.get("http_req_duration", {}))
    http_failed = extract_metric(metrics.get("http_req_failed", {}))

    total_count = http_reqs.get("count", 0)
    real_tps = http_reqs.get("rate", 0)
    real_avg_response = http_duration.get("avg", 0)
    real_error_rate_raw = http_failed.get("value", 0)

    is_server_dead = (total_count == 0) or (real_error_rate_raw >= 0.99)
    real_error_rate = 100.0 if is_server_dead else real_error_rate_raw * 100
    threshold_failures = []
    for metric_name, metric_data in metrics.items():
        thresholds = metric_data.get("thresholds", {}) if isinstance(metric_data, dict) else {}
        for threshold_name, threshold_result in thresholds.items():
            passed = (
                threshold_result.get("ok")
                if isinstance(threshold_result, dict)
                else threshold_result
            )
            if passed is False:
                threshold_failures.append(f"{metric_name}: {threshold_name}")

    return {
        "real_request_count": total_count,
        "real_tps": real_tps,
        "real_avg_response": real_avg_response,
        "real_error_rate": real_error_rate,
        "is_server_dead": is_server_dead,
        "duration": duration,
        "threshold_failures": threshold_failures,
    }


def round_score(value: float) -> int:
    return int(math.floor(value + 0.5))


def calculate_performance_assessment(
    summary: LoadTestSummary,
) -> PerformanceAssessment:
    if summary.get("is_server_dead"):
        reliability_score = 0
        latency_score = 0
    else:
        error_rate = max(0.0, float(summary.get("real_error_rate", 0)))
        avg_response = max(0.0, float(summary.get("real_avg_response", 0)))

        reliability_score = round_score(60 * max(0.0, 1 - (error_rate / 5)))

        if avg_response <= 200:
            latency_points = 40
        elif avg_response <= 500:
            latency_points = 40 - ((avg_response - 200) / 300 * 10)
        elif avg_response <= 1000:
            latency_points = 30 - ((avg_response - 500) / 500 * 15)
        elif avg_response < 2000:
            latency_points = 15 - ((avg_response - 1000) / 1000 * 15)
        else:
            latency_points = 0

        latency_score = round_score(max(0.0, latency_points))

    score = max(0, min(100, reliability_score + latency_score))

    if score >= 90:
        grade, label = "A", "우수"
    elif score >= 80:
        grade, label = "B", "양호"
    elif score >= 70:
        grade, label = "C", "보통"
    elif score >= 60:
        grade, label = "D", "개선 필요"
    else:
        grade, label = "F", "위험"

    return PerformanceAssessment(
        score=score,
        grade=grade,
        label=label,
        breakdown=ScoreBreakdown(
            reliabilityScore=reliability_score,
            latencyScore=latency_score,
        ),
    )


def calculate_performance_assessment_v2(
    summary: LoadTestSummary,
    context: LoadAnalysisContext,
    targets: Optional[PerformanceTargets],
    duration: int,
) -> PerformanceScoreResult:
    effective_targets = targets or PerformanceTargets()
    if not _is_v2_eligible(summary, context):
        return PerformanceScoreResult(
            assessment=calculate_performance_assessment(summary),
            version=1,
            status="FALLBACK_INSUFFICIENT_DATA",
            targets=effective_targets,
        )

    error_rate = max(0.0, float(summary.get("real_error_rate", 0)))
    p95_response = max(0.0, float(summary["p95_response"]))
    reliability_score = _score_with_tolerance(
        error_rate,
        effective_targets.maxErrorRate,
        max(5.0, effective_targets.maxErrorRate * 5),
        40,
    )
    latency_score = _score_with_tolerance(
        p95_response,
        effective_targets.targetP95Ms,
        effective_targets.targetP95Ms * 4,
        40,
    )
    scaling_efficiency = max(0.0, min(1.0, float(context.scalingEfficiency or 0)))
    sustainable_tps = calculate_sustainable_tps(
        summary.get("chart_points", []),
        effective_targets,
        duration,
    )

    if effective_targets.targetTps is not None:
        scalability_score = round_score(10 * scaling_efficiency)
        scalability_score += round_score(
            10 * min(1.0, (sustainable_tps or 0) / effective_targets.targetTps)
        )
    else:
        scalability_score = round_score(20 * scaling_efficiency)

    score = max(0, min(100, reliability_score + latency_score + scalability_score))
    grade, label = _grade_for_score(score)
    return PerformanceScoreResult(
        assessment=PerformanceAssessment(
            score=score,
            grade=grade,
            label=label,
            breakdown=ScoreBreakdown(
                reliabilityScore=reliability_score,
                latencyScore=latency_score,
                scalabilityScore=scalability_score,
            ),
        ),
        version=2,
        status="CUSTOM_SLO" if effective_targets.targetTps is not None else "DEFAULT_SLO",
        targets=effective_targets,
        sustainableTps=sustainable_tps,
    )


def calculate_sustainable_tps(
    points: list[Any],
    targets: PerformanceTargets,
    duration: int,
) -> Optional[float]:
    normalized = [
        point.model_dump() if hasattr(point, "model_dump") else point
        for point in points
    ]
    if not normalized:
        return None

    requested_window = min(10, max(3, int(duration * 0.1)))
    window_size = min(len(normalized), requested_window)
    maximum_average: Optional[float] = None
    for start in range(0, len(normalized) - window_size + 1):
        window = normalized[start:start + window_size]
        if not all(_point_meets_targets(point, targets) for point in window):
            continue
        average_tps = sum(max(0.0, float(point.get("tps", 0))) for point in window) / window_size
        maximum_average = max(maximum_average or 0.0, average_tps)
    return round(maximum_average, 2) if maximum_average is not None else None


def _is_v2_eligible(summary: LoadTestSummary, context: LoadAnalysisContext) -> bool:
    return (
        summary.get("data_origin") == "MEASURED_K6"
        and summary.get("p95_response") is not None
        and context.coverageRatio >= 0.9
        and context.scalingEfficiency is not None
        and len(context.stages) >= 2
    )


def _point_meets_targets(point: dict[str, Any], targets: PerformanceTargets) -> bool:
    p95 = point.get("p95Response")
    error_rate = point.get("errorRate")
    return (
        p95 is not None
        and error_rate is not None
        and float(p95) <= targets.targetP95Ms
        and float(error_rate) <= targets.maxErrorRate
    )


def _score_with_tolerance(value: float, target: float, zero_at: float, maximum: int) -> int:
    if value <= target:
        return maximum
    if value >= zero_at or zero_at <= target:
        return 0
    ratio = 1 - ((value - target) / (zero_at - target))
    return round_score(maximum * ratio)


def _grade_for_score(score: int) -> tuple[str, str]:
    if score >= 90:
        return "A", "우수"
    if score >= 80:
        return "B", "양호"
    if score >= 70:
        return "C", "보통"
    if score >= 60:
        return "D", "개선 필요"
    return "F", "위험"
