import gzip
import json
import math
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, BinaryIO, Dict, List, Optional

from .models import ChartPoint, DiagnosticMetrics, RequestDiagnostic, TimingBreakdown


TRACKED_METRICS = {
    "http_reqs",
    "http_req_duration",
    "http_req_failed",
    "vus",
    "http_req_blocked",
    "http_req_connecting",
    "http_req_tls_handshaking",
    "http_req_sending",
    "http_req_waiting",
    "http_req_receiving",
    "iterations",
    "dropped_iterations",
    "checks",
}

TIMING_METRIC_FIELDS = {
    "http_req_blocked": "blockedMs",
    "http_req_connecting": "connectingMs",
    "http_req_tls_handshaking": "tlsHandshakingMs",
    "http_req_sending": "sendingMs",
    "http_req_waiting": "waitingMs",
    "http_req_receiving": "receivingMs",
}
MAX_DIAGNOSTIC_GROUPS = 10


class MetricStreamParseError(Exception):
    """Raised when the compressed k6 metric stream cannot be read."""


class P2Quantile:
    """Constant-memory P² quantile estimator."""

    def __init__(self, quantile: float) -> None:
        if not 0 < quantile < 1:
            raise ValueError("분위수는 0과 1 사이여야 합니다.")
        self.quantile = quantile
        self.count = 0
        self.initial: List[float] = []
        self.heights: List[float] = []
        self.positions: List[int] = []
        self.desired: List[float] = []
        self.increments = [
            0.0,
            quantile / 2,
            quantile,
            (1 + quantile) / 2,
            1.0,
        ]

    def add(self, value: float) -> None:
        self.count += 1
        if self.count <= 5:
            self.initial.append(value)
            if self.count == 5:
                self.initial.sort()
                self.heights = self.initial.copy()
                self.positions = [1, 2, 3, 4, 5]
                q = self.quantile
                self.desired = [1, 1 + (2 * q), 1 + (4 * q), 3 + (2 * q), 5]
            return

        if value < self.heights[0]:
            self.heights[0] = value
            marker = 0
        elif value < self.heights[1]:
            marker = 0
        elif value < self.heights[2]:
            marker = 1
        elif value < self.heights[3]:
            marker = 2
        elif value <= self.heights[4]:
            marker = 3
        else:
            self.heights[4] = value
            marker = 3

        for index in range(marker + 1, 5):
            self.positions[index] += 1
        for index in range(5):
            self.desired[index] += self.increments[index]

        for index in range(1, 4):
            delta = self.desired[index] - self.positions[index]
            direction = 1 if delta >= 1 else -1 if delta <= -1 else 0
            if direction == 0:
                continue
            if direction > 0 and self.positions[index + 1] - self.positions[index] <= 1:
                continue
            if direction < 0 and self.positions[index - 1] - self.positions[index] >= -1:
                continue

            candidate = self._parabolic(index, direction)
            if self.heights[index - 1] < candidate < self.heights[index + 1]:
                self.heights[index] = candidate
            else:
                self.heights[index] = self._linear(index, direction)
            self.positions[index] += direction

    def value(self) -> Optional[float]:
        if self.count == 0:
            return None
        if self.count <= 5:
            ordered = sorted(self.initial)
            rank = max(0, math.ceil(self.quantile * len(ordered)) - 1)
            return ordered[rank]
        return self.heights[2]

    def _parabolic(self, index: int, direction: int) -> float:
        previous_position = self.positions[index - 1]
        current_position = self.positions[index]
        next_position = self.positions[index + 1]
        previous_height = self.heights[index - 1]
        current_height = self.heights[index]
        next_height = self.heights[index + 1]

        return current_height + direction / (next_position - previous_position) * (
            (current_position - previous_position + direction)
            * (next_height - current_height)
            / (next_position - current_position)
            + (next_position - current_position - direction)
            * (current_height - previous_height)
            / (current_position - previous_position)
        )

    def _linear(self, index: int, direction: int) -> float:
        adjacent = index + direction
        return self.heights[index] + direction * (
            (self.heights[adjacent] - self.heights[index])
            / (self.positions[adjacent] - self.positions[index])
        )


@dataclass
class MetricBucket:
    requests: float = 0.0
    duration_sum: float = 0.0
    duration_count: int = 0
    p95: P2Quantile = field(default_factory=lambda: P2Quantile(0.95))
    failed_sum: float = 0.0
    failed_count: int = 0
    vus: Optional[int] = None
    vus_timestamp: float = float("-inf")

    @property
    def contains_request_data(self) -> bool:
        return self.requests > 0 or self.duration_count > 0 or self.failed_count > 0


@dataclass(frozen=True)
class MetricAggregationResult:
    points: List[ChartPoint]
    request_count: float
    avg_response: Optional[float]
    error_rate: Optional[float]
    max_tps: Optional[int]
    p95_response: Optional[float]
    status: str
    warning: Optional[str]
    data_origin: str
    diagnostics: Optional[DiagnosticMetrics] = None


@dataclass
class OperationAccumulator:
    requests: float = 0.0
    duration_sum: float = 0.0
    duration_count: int = 0
    failed_sum: float = 0.0
    failed_count: int = 0


@dataclass
class DiagnosticAccumulator:
    timing_sum: Dict[str, float] = field(default_factory=dict)
    timing_count: Dict[str, int] = field(default_factory=dict)
    iterations: float = 0.0
    dropped_iterations: float = 0.0
    check_sum: float = 0.0
    check_count: int = 0
    status_codes: Dict[str, float] = field(default_factory=dict)
    operations: Dict[str, OperationAccumulator] = field(default_factory=dict)

    def record(self, metric_name: str, value: float, tags: Dict[str, Any]) -> None:
        timing_field = TIMING_METRIC_FIELDS.get(metric_name)
        if timing_field:
            self.timing_sum[timing_field] = self.timing_sum.get(timing_field, 0.0) + value
            self.timing_count[timing_field] = self.timing_count.get(timing_field, 0) + 1
        elif metric_name == "iterations":
            self.iterations += value
        elif metric_name == "dropped_iterations":
            self.dropped_iterations += value
        elif metric_name == "checks":
            self.check_sum += value
            self.check_count += 1

        status = str(tags.get("status") or "").strip()
        if metric_name == "http_reqs" and status:
            self.status_codes[status] = self.status_codes.get(status, 0.0) + value

        operation_name = str(tags.get("name") or tags.get("url") or "").strip()
        if not operation_name:
            return
        operation = self.operations.setdefault(operation_name, OperationAccumulator())
        if metric_name == "http_reqs":
            operation.requests += value
        elif metric_name == "http_req_duration":
            operation.duration_sum += value
            operation.duration_count += 1
        elif metric_name == "http_req_failed":
            operation.failed_sum += value
            operation.failed_count += 1

    def build(self) -> DiagnosticMetrics:
        timing_values = {
            field_name: round(total / self.timing_count[field_name], 2)
            for field_name, total in self.timing_sum.items()
            if self.timing_count.get(field_name)
        }
        status_codes = dict(
            sorted(
                ((status, max(0, int(round(count)))) for status, count in self.status_codes.items()),
                key=lambda item: item[1],
                reverse=True,
            )[:MAX_DIAGNOSTIC_GROUPS]
        )
        operations = sorted(
            self.operations.items(),
            key=lambda item: item[1].requests,
            reverse=True,
        )[:MAX_DIAGNOSTIC_GROUPS]
        return DiagnosticMetrics(
            timing=TimingBreakdown(**timing_values),
            iterations=max(0, int(round(self.iterations))),
            droppedIterations=max(0, int(round(self.dropped_iterations))),
            checkFailureRate=(
                round((1 - (self.check_sum / self.check_count)) * 100, 2)
                if self.check_count
                else None
            ),
            statusCodes=status_codes,
            requests=[
                RequestDiagnostic(
                    name=name[:500],
                    requests=max(0, int(round(operation.requests))),
                    avgResponse=(
                        round(operation.duration_sum / operation.duration_count, 2)
                        if operation.duration_count
                        else None
                    ),
                    errorRate=(
                        round(operation.failed_sum / operation.failed_count * 100, 2)
                        if operation.failed_count
                        else None
                    ),
                )
                for name, operation in operations
            ],
        )


def aggregate_k6_metric_stream(
    compressed_stream: BinaryIO,
    duration: int,
) -> MetricAggregationResult:
    buckets: Dict[int, MetricBucket] = {}
    overall_p95 = P2Quantile(0.95)
    diagnostics = DiagnosticAccumulator()
    invalid_lines = 0

    try:
        with gzip.open(compressed_stream, mode="rt", encoding="utf-8") as metric_lines:
            for line in metric_lines:
                try:
                    payload: Dict[str, Any] = json.loads(line)
                    if payload.get("type") != "Point":
                        continue

                    metric_name = payload.get("metric")
                    if metric_name not in TRACKED_METRICS:
                        continue

                    data = payload.get("data")
                    if not isinstance(data, dict):
                        raise ValueError("성능 지표에 데이터 객체가 없습니다.")

                    timestamp = _parse_timestamp(data.get("time"))
                    value = float(data.get("value"))
                    if not math.isfinite(value):
                        raise ValueError("성능 지표 값이 유효한 숫자가 아닙니다.")

                    bucket_key = math.floor(timestamp)
                    bucket = buckets.setdefault(bucket_key, MetricBucket())
                    _record_metric(bucket, metric_name, value, timestamp, overall_p95)
                    tags = data.get("tags") if isinstance(data.get("tags"), dict) else {}
                    diagnostics.record(metric_name, value, tags)
                except (json.JSONDecodeError, TypeError, ValueError, OverflowError):
                    invalid_lines += 1
    except (OSError, EOFError, UnicodeError) as exc:
        raise MetricStreamParseError("k6 시계열 압축 파일을 읽을 수 없습니다.") from exc

    active_keys = sorted(
        key for key, bucket in buckets.items() if bucket.contains_request_data
    )
    if not active_keys:
        return MetricAggregationResult(
            points=[],
            request_count=0.0,
            avg_response=None,
            error_rate=None,
            max_tps=None,
            p95_response=None,
            status="UNAVAILABLE",
            warning="k6 시계열 파일에 HTTP 요청 측정값이 없습니다.",
            data_origin="NOT_COLLECTED",
            diagnostics=diagnostics.build(),
        )

    start_key = active_keys[0]
    end_key = active_keys[-1]
    maximum_span = max(1, duration + 5)
    truncated = end_key - start_key + 1 > maximum_span
    if truncated:
        end_key = start_key + maximum_span - 1

    points: List[ChartPoint] = []
    previous_vus = [
        (bucket.vus_timestamp, bucket.vus)
        for key, bucket in buckets.items()
        if key <= start_key and bucket.vus is not None
    ]
    last_vus: Optional[int] = (
        max(previous_vus, key=lambda item: item[0])[1] if previous_vus else None
    )
    for bucket_key in range(start_key, end_key + 1):
        bucket = buckets.get(bucket_key, MetricBucket())
        if bucket.vus is not None:
            last_vus = bucket.vus

        elapsed_seconds = bucket_key - start_key
        points.append(
            ChartPoint(
                time=_format_elapsed_time(elapsed_seconds),
                elapsedSeconds=elapsed_seconds,
                tps=max(0, int(round(bucket.requests))),
                avgResponse=(
                    round(bucket.duration_sum / bucket.duration_count, 2)
                    if bucket.duration_count
                    else None
                ),
                p95Response=_rounded_optional(bucket.p95.value()),
                errorRate=(
                    round(bucket.failed_sum / bucket.failed_count * 100, 2)
                    if bucket.failed_count
                    else None
                ),
                vus=last_vus,
            )
        )

    warnings: List[str] = []
    if invalid_lines:
        warnings.append(f"해석할 수 없는 측정값 {invalid_lines}개를 제외했습니다.")
    if truncated:
        warnings.append("요청한 테스트 시간을 벗어난 측정 구간을 제외했습니다.")

    total_request_count = sum(bucket.requests for bucket in buckets.values())
    total_duration_sum = sum(bucket.duration_sum for bucket in buckets.values())
    total_duration_count = sum(bucket.duration_count for bucket in buckets.values())
    total_failed_sum = sum(bucket.failed_sum for bucket in buckets.values())
    total_failed_count = sum(bucket.failed_count for bucket in buckets.values())

    return MetricAggregationResult(
        points=points,
        request_count=total_request_count,
        avg_response=(
            total_duration_sum / total_duration_count
            if total_duration_count
            else None
        ),
        error_rate=(
            total_failed_sum / total_failed_count * 100
            if total_failed_count
            else None
        ),
        max_tps=max(point.tps for point in points),
        p95_response=_rounded_optional(overall_p95.value()),
        status="PARTIAL" if warnings else "COMPLETE",
        warning=" ".join(warnings) or None,
        data_origin="MEASURED_K6",
        diagnostics=diagnostics.build(),
    )


def _record_metric(
    bucket: MetricBucket,
    metric_name: str,
    value: float,
    timestamp: float,
    overall_p95: P2Quantile,
) -> None:
    if metric_name == "http_reqs":
        bucket.requests += value
    elif metric_name == "http_req_duration":
        bucket.duration_sum += value
        bucket.duration_count += 1
        bucket.p95.add(value)
        overall_p95.add(value)
    elif metric_name == "http_req_failed":
        bucket.failed_sum += value
        bucket.failed_count += 1
    elif metric_name == "vus" and timestamp >= bucket.vus_timestamp:
        bucket.vus = max(0, int(round(value)))
        bucket.vus_timestamp = timestamp


def _parse_timestamp(value: Any) -> float:
    if not isinstance(value, str) or not value:
        raise ValueError("성능 지표의 측정 시간이 없습니다.")
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    return datetime.fromisoformat(normalized).timestamp()


def _format_elapsed_time(elapsed_seconds: int) -> str:
    minutes, seconds = divmod(elapsed_seconds, 60)
    return f"{minutes:02d}:{seconds:02d}"


def _rounded_optional(value: Optional[float]) -> Optional[float]:
    return round(value, 2) if value is not None else None
