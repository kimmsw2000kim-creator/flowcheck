import math
from typing import Any, Dict

from .models import PerformanceAssessment, ScoreBreakdown

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

    return {
        "real_tps": real_tps,
        "real_avg_response": real_avg_response,
        "real_error_rate": real_error_rate,
        "is_server_dead": is_server_dead,
        "duration": duration,
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
