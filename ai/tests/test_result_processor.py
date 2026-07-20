import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from load_test.result_processor import (
    calculate_performance_assessment,
    extract_metric,
    parse_k6_summary,
)


class ResultProcessorTest(unittest.TestCase):
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

if __name__ == "__main__":
    unittest.main()
