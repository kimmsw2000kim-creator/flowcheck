import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from load_test.result_processor import (
    calculate_performance_assessment,
    calculate_performance_assessment_v2,
    extract_metric,
    parse_k6_summary,
)
from load_test.analysis_engine import build_analysis_context
from load_test.models import PerformanceTargets


class ResultProcessorTest(unittest.TestCase):
    def measured_summary(self):
        points = []
        for second in range(6):
            high_load = second >= 3
            points.append({
                "time": f"00:0{second}",
                "elapsedSeconds": second,
                "tps": 20 if high_load else 10,
                "avgResponse": 100,
                "p95Response": 150,
                "errorRate": 0,
                "vus": 10 if high_load else 5,
            })
        return {
            "real_request_count": 90,
            "real_tps": 15,
            "real_avg_response": 100,
            "real_error_rate": 0,
            "p95_response": 150,
            "data_origin": "MEASURED_K6",
            "chart_points": points,
            "is_server_dead": False,
        }

    def test_extract_metric_supports_flat_and_nested_values(self):
        self.assertEqual({"count": 1}, extract_metric({"count": 1}))
        self.assertEqual({"count": 2}, extract_metric({"values": {"count": 2}}))

    def test_parse_normal_metrics(self):
        result = parse_k6_summary(
            {
                "metrics": {
                    "http_reqs": {"values": {"count": 100, "rate": 20.5}},
                    "http_req_duration": {"values": {"avg": 321.5}},
                    "http_req_failed": {"values": {"value": 0.012}},
                }
            },
            30,
        )

        self.assertEqual(20.5, result["real_tps"])
        self.assertEqual(100, result["real_request_count"])
        self.assertEqual(321.5, result["real_avg_response"])
        self.assertEqual(1.2, result["real_error_rate"])
        self.assertFalse(result["is_server_dead"])
        self.assertEqual(30, result["duration"])

    def test_parse_marks_zero_requests_as_dead(self):
        result = parse_k6_summary({"metrics": {}}, 10)
        self.assertTrue(result["is_server_dead"])
        self.assertEqual(100.0, result["real_error_rate"])

    def test_parse_marks_99_percent_failures_as_dead(self):
        result = parse_k6_summary(
            {
                "metrics": {
                    "http_reqs": {"count": 10, "rate": 1},
                    "http_req_failed": {"value": 0.99},
                }
            },
            10,
        )
        self.assertTrue(result["is_server_dead"])

    def test_scoring_boundaries(self):
        cases = [
            (0, 200, 100, "A"),
            (1, 500, 78, "C"),
            (5, 1000, 15, "F"),
            (0, 2000, 60, "D"),
        ]
        for error_rate, avg_response, score, grade in cases:
            with self.subTest(error_rate=error_rate, avg_response=avg_response):
                assessment = calculate_performance_assessment(
                    {
                        "real_error_rate": error_rate,
                        "real_avg_response": avg_response,
                        "is_server_dead": False,
                    }
                )
                self.assertEqual(score, assessment.score)
                self.assertEqual(grade, assessment.grade)

    def test_dead_server_scores_zero(self):
        assessment = calculate_performance_assessment({"is_server_dead": True})
        self.assertEqual(0, assessment.score)
        self.assertEqual(0, assessment.breakdown.reliabilityScore)
        self.assertEqual(0, assessment.breakdown.latencyScore)

    def test_v2_score_uses_tail_latency_reliability_and_scalability(self):
        summary = self.measured_summary()
        context = build_analysis_context(summary)

        result = calculate_performance_assessment_v2(summary, context, None, duration=10)

        self.assertEqual(2, result.version)
        self.assertEqual("DEFAULT_SLO", result.status)
        self.assertEqual(100, result.assessment.score)
        self.assertEqual(20, result.assessment.breakdown.scalabilityScore)
        self.assertEqual(20.0, result.sustainableTps)

    def test_v2_score_applies_custom_throughput_target(self):
        summary = self.measured_summary()
        context = build_analysis_context(summary)

        result = calculate_performance_assessment_v2(
            summary,
            context,
            PerformanceTargets(targetTps=20, targetP95Ms=200, maxErrorRate=1),
            duration=10,
        )

        self.assertEqual("CUSTOM_SLO", result.status)
        self.assertEqual(100, result.assessment.score)

    def test_v2_score_falls_back_when_metric_coverage_is_insufficient(self):
        summary = self.measured_summary()
        summary["chart_points"][0]["p95Response"] = None
        context = build_analysis_context(summary)

        result = calculate_performance_assessment_v2(summary, context, None, duration=10)

        self.assertEqual(1, result.version)
        self.assertEqual("FALLBACK_INSUFFICIENT_DATA", result.status)
        self.assertIsNone(result.assessment.breakdown.scalabilityScore)

if __name__ == "__main__":
    unittest.main()
