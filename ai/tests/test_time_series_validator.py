import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from load_test.models import ChartPoint
from load_test.time_series_aggregator import MetricAggregationResult
from load_test.time_series_validator import validate_time_series_consistency


def aggregation_result(**overrides):
    values = {
        "points": [
            ChartPoint(
                time="00:00",
                elapsedSeconds=0,
                tps=2,
                avgResponse=200,
                errorRate=50,
            )
        ],
        "request_count": 2.0,
        "avg_response": 200.0,
        "error_rate": 50.0,
        "max_tps": 2,
        "p95_response": 300.0,
        "status": "COMPLETE",
        "warning": None,
        "data_origin": "MEASURED_K6",
    }
    values.update(overrides)
    return MetricAggregationResult(**values)


class TimeSeriesValidatorTest(unittest.TestCase):
    def test_keeps_complete_status_when_summary_and_series_match(self):
        result = validate_time_series_consistency(
            {
                "real_request_count": 2,
                "real_avg_response": 200,
                "real_error_rate": 50,
            },
            aggregation_result(),
            duration=10,
        )

        self.assertEqual("COMPLETE", result.status)
        self.assertIsNone(result.warning)

    def test_marks_partial_and_describes_summary_mismatches(self):
        result = validate_time_series_consistency(
            {
                "real_request_count": 20,
                "real_avg_response": 100,
                "real_error_rate": 0,
            },
            aggregation_result(),
            duration=10,
        )

        self.assertEqual("PARTIAL", result.status)
        self.assertIn("요청 수", result.warning)
        self.assertIn("평균 응답시간", result.warning)
        self.assertIn("오류율", result.warning)

    def test_marks_partial_for_invalid_timeline_and_max_tps(self):
        result = validate_time_series_consistency(
            {
                "real_request_count": 2,
                "real_avg_response": 200,
                "real_error_rate": 50,
            },
            aggregation_result(
                points=[
                    ChartPoint(
                        time="00:01",
                        elapsedSeconds=1,
                        tps=2,
                        avgResponse=200,
                        errorRate=50,
                    )
                ],
                max_tps=3,
            ),
            duration=10,
        )

        self.assertEqual("PARTIAL", result.status)
        self.assertIn("시작 시점", result.warning)
        self.assertIn("최대 TPS", result.warning)

    def test_preserves_unavailable_result_without_extra_warnings(self):
        unavailable = aggregation_result(
            points=[],
            request_count=0,
            avg_response=None,
            error_rate=None,
            max_tps=None,
            p95_response=None,
            status="UNAVAILABLE",
            warning="원본 없음",
            data_origin="NOT_COLLECTED",
        )

        result = validate_time_series_consistency({}, unavailable, duration=10)

        self.assertIs(result, unavailable)
        self.assertEqual("원본 없음", result.warning)


if __name__ == "__main__":
    unittest.main()
