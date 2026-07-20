import gzip
import io
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from load_test.time_series_aggregator import (
    MetricStreamParseError,
    P2Quantile,
    aggregate_k6_metric_stream,
)


def compressed_metric_stream(items):
    content = "\n".join(
        item if isinstance(item, str) else json.dumps(item) for item in items
    )
    return io.BytesIO(gzip.compress(content.encode("utf-8")))


def point(metric, timestamp, value):
    return {
        "type": "Point",
        "metric": metric,
        "data": {"time": timestamp, "value": value, "tags": {}},
    }


class P2QuantileTest(unittest.TestCase):
    def test_estimates_p95_with_constant_memory(self):
        estimator = P2Quantile(0.95)
        for value in range(1, 1001):
            estimator.add(float(value))

        self.assertAlmostEqual(950, estimator.value(), delta=10)
        self.assertLessEqual(len(estimator.heights), 5)


class TimeSeriesAggregatorTest(unittest.TestCase):
    def test_aggregates_measured_points_into_one_second_buckets(self):
        stream = compressed_metric_stream(
            [
                point("vus", "2026-01-01T00:00:00.100Z", 2),
                point("http_reqs", "2026-01-01T00:00:00.200Z", 1),
                point("http_req_duration", "2026-01-01T00:00:00.200Z", 100),
                point("http_req_failed", "2026-01-01T00:00:00.200Z", 0),
                point("http_reqs", "2026-01-01T00:00:00.800Z", 1),
                point("http_req_duration", "2026-01-01T00:00:00.800Z", 300),
                point("http_req_failed", "2026-01-01T00:00:00.800Z", 1),
                point("vus", "2026-01-01T00:00:01.100Z", 3),
                point("http_reqs", "2026-01-01T00:00:01.200Z", 1),
                point("http_req_duration", "2026-01-01T00:00:01.200Z", 200),
                point("http_req_failed", "2026-01-01T00:00:01.200Z", 0),
            ]
        )

        result = aggregate_k6_metric_stream(stream, duration=10)

        self.assertEqual("COMPLETE", result.status)
        self.assertEqual("MEASURED_K6", result.data_origin)
        self.assertEqual(2, result.max_tps)
        self.assertEqual(300, result.p95_response)
        self.assertEqual(2, len(result.points))

        first, second = result.points
        self.assertEqual("00:00", first.time)
        self.assertEqual(2, first.tps)
        self.assertEqual(200, first.avgResponse)
        self.assertEqual(300, first.p95Response)
        self.assertEqual(50, first.errorRate)
        self.assertEqual(2, first.vus)

        self.assertEqual("00:01", second.time)
        self.assertEqual(1, second.tps)
        self.assertEqual(200, second.avgResponse)
        self.assertEqual(0, second.errorRate)
        self.assertEqual(3, second.vus)

    def test_marks_partial_when_malformed_points_are_skipped(self):
        stream = compressed_metric_stream(
            [
                "not-json",
                point("http_reqs", "2026-01-01T00:00:00Z", 1),
                point("http_req_duration", "2026-01-01T00:00:00Z", 100),
            ]
        )

        result = aggregate_k6_metric_stream(stream, duration=10)

        self.assertEqual("PARTIAL", result.status)
        self.assertIn("1개", result.warning)
        self.assertEqual(1, len(result.points))

    def test_returns_unavailable_without_http_request_measurements(self):
        stream = compressed_metric_stream(
            [point("vus", "2026-01-01T00:00:00Z", 2)]
        )

        result = aggregate_k6_metric_stream(stream, duration=10)

        self.assertEqual("UNAVAILABLE", result.status)
        self.assertEqual("NOT_COLLECTED", result.data_origin)
        self.assertEqual([], result.points)

    def test_carries_forward_vus_observed_before_first_request_bucket(self):
        stream = compressed_metric_stream(
            [
                point("vus", "2026-01-01T00:00:00Z", 7),
                point("http_reqs", "2026-01-01T00:00:01Z", 1),
                point("http_req_duration", "2026-01-01T00:00:01Z", 100),
            ]
        )

        result = aggregate_k6_metric_stream(stream, duration=10)

        self.assertEqual(7, result.points[0].vus)

    def test_rejects_invalid_gzip_stream(self):
        with self.assertRaises(MetricStreamParseError):
            aggregate_k6_metric_stream(io.BytesIO(b"not-gzip"), duration=10)


if __name__ == "__main__":
    unittest.main()
