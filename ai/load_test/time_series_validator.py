from dataclasses import replace
from typing import List

from .result_processor import LoadTestSummary
from .time_series_aggregator import MetricAggregationResult


REQUEST_COUNT_RELATIVE_TOLERANCE = 0.005
AVERAGE_RESPONSE_RELATIVE_TOLERANCE = 0.01
ERROR_RATE_ABSOLUTE_TOLERANCE = 0.1


def validate_time_series_consistency(
    summary: LoadTestSummary,
    aggregation: MetricAggregationResult,
    duration: int,
) -> MetricAggregationResult:
    if aggregation.status == "UNAVAILABLE":
        return aggregation

    warnings: List[str] = [aggregation.warning] if aggregation.warning else []
    _validate_request_count(summary, aggregation, warnings)
    _validate_average_response(summary, aggregation, warnings)
    _validate_error_rate(summary, aggregation, warnings)
    _validate_timeline(aggregation, duration, warnings)
    _validate_max_tps(aggregation, warnings)

    if not warnings:
        return aggregation

    return replace(
        aggregation,
        status="PARTIAL",
        warning=" ".join(warnings),
    )


def _validate_request_count(
    summary: LoadTestSummary,
    aggregation: MetricAggregationResult,
    warnings: List[str],
) -> None:
    summary_count = max(0.0, float(summary.get("real_request_count", 0)))
    tolerance = max(1.0, summary_count * REQUEST_COUNT_RELATIVE_TOLERANCE)
    if abs(summary_count - aggregation.request_count) > tolerance:
        warnings.append(
            "종료 요약 요청 수와 시계열 요청 수가 일치하지 않습니다"
            f"({summary_count:g}건/{aggregation.request_count:g}건)."
        )


def _validate_average_response(
    summary: LoadTestSummary,
    aggregation: MetricAggregationResult,
    warnings: List[str],
) -> None:
    if aggregation.avg_response is None:
        warnings.append("시계열 평균 응답시간을 계산할 표본이 없습니다.")
        return

    summary_average = max(0.0, float(summary.get("real_avg_response", 0)))
    tolerance = max(1.0, summary_average * AVERAGE_RESPONSE_RELATIVE_TOLERANCE)
    if abs(summary_average - aggregation.avg_response) > tolerance:
        warnings.append(
            "종료 요약과 시계열의 평균 응답시간이 일치하지 않습니다"
            f"({summary_average:.2f}ms/{aggregation.avg_response:.2f}ms)."
        )


def _validate_error_rate(
    summary: LoadTestSummary,
    aggregation: MetricAggregationResult,
    warnings: List[str],
) -> None:
    if aggregation.error_rate is None:
        warnings.append("시계열 오류율을 계산할 표본이 없습니다.")
        return

    summary_error_rate = max(0.0, float(summary.get("real_error_rate", 0)))
    if abs(summary_error_rate - aggregation.error_rate) > ERROR_RATE_ABSOLUTE_TOLERANCE:
        warnings.append(
            "종료 요약과 시계열의 오류율이 일치하지 않습니다"
            f"({summary_error_rate:.2f}%/{aggregation.error_rate:.2f}%)."
        )


def _validate_timeline(
    aggregation: MetricAggregationResult,
    duration: int,
    warnings: List[str],
) -> None:
    elapsed_values = [point.elapsedSeconds for point in aggregation.points]
    if not elapsed_values or elapsed_values[0] != 0:
        warnings.append("시계열이 테스트 시작 시점부터 기록되지 않았습니다.")
        return

    expected = list(range(len(elapsed_values)))
    if elapsed_values != expected:
        warnings.append("시계열 시간값이 연속적이지 않습니다.")

    if elapsed_values[-1] is not None and elapsed_values[-1] > duration:
        warnings.append("시계열이 요청한 테스트 시간을 초과합니다.")


def _validate_max_tps(
    aggregation: MetricAggregationResult,
    warnings: List[str],
) -> None:
    calculated_max = max((point.tps for point in aggregation.points), default=None)
    if aggregation.max_tps != calculated_max:
        warnings.append("최대 TPS가 시계열 포인트와 일치하지 않습니다.")
