import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from load_test.analysis_engine import build_analysis_context


def point(second, tps, vus, avg_response, p95_response, error_rate=0):
    return {
        "time": f"00:{second:02d}",
        "elapsedSeconds": second,
        "tps": tps,
        "vus": vus,
        "avgResponse": avg_response,
        "p95Response": p95_response,
        "errorRate": error_rate,
    }


class LoadAnalysisEngineTest(unittest.TestCase):
    def test_summarizes_declared_stages(self):
        summary = {
            "chart_points": [
                point(0, 10, 5, 100, 150),
                point(1, 12, 5, 110, 160),
                point(2, 18, 10, 140, 220),
                point(3, 20, 10, 150, 240),
            ]
        }
        profile = [
            {"duration": "2000ms", "target": 5},
            {"duration": "2000ms", "target": 10},
        ]

        context = build_analysis_context(summary, profile)

        self.assertEqual(2, len(context.stages))
        self.assertEqual("STAGE_1_TARGET_5", context.stages[0].stage)
        self.assertEqual(22, context.stages[0].requestCount)
        self.assertEqual(11, context.stages[0].avgTps)
        self.assertEqual(1.0, context.coverageRatio)

    def test_detects_saturation_tail_latency_and_error_onset(self):
        summary = {
            "chart_points": [
                point(0, 20, 10, 100, 150),
                point(1, 20, 10, 100, 150),
                point(2, 22, 20, 300, 400, 2),
                point(3, 22, 20, 350, 450, 3),
            ]
        }

        context = build_analysis_context(summary)
        signal_types = {signal.type for signal in context.bottlenecks}

        self.assertIn("THROUGHPUT_SATURATION", signal_types)
        self.assertIn("TAIL_LATENCY_DEGRADATION", signal_types)
        self.assertIn("ERROR_RATE_INCREASE", signal_types)
        self.assertAlmostEqual(0.55, context.scalingEfficiency)

    def test_reports_partial_metric_coverage(self):
        summary = {
            "chart_points": [
                point(0, 10, 5, 100, 150),
                {"time": "00:01", "elapsedSeconds": 1, "tps": 0, "vus": 5},
            ]
        }

        context = build_analysis_context(summary)

        self.assertEqual(0.5, context.coverageRatio)

    def test_returns_empty_context_without_time_series(self):
        context = build_analysis_context({"chart_points": []})

        self.assertEqual([], context.stages)
        self.assertEqual([], context.bottlenecks)
        self.assertEqual(0.0, context.coverageRatio)

    def test_excludes_declared_ramp_down_from_scalability_comparison(self):
        summary = {
            "chart_points": [
                point(0, 4, 2, 100, 150), point(1, 4, 2, 100, 150),
                point(2, 10, 5, 100, 150), point(3, 10, 5, 100, 150),
                point(4, 20, 10, 100, 150), point(5, 20, 10, 100, 150),
                point(6, 20, 10, 100, 150), point(7, 20, 10, 100, 150),
                point(8, 10, 5, 100, 150), point(9, 0, 0, 100, 150),
            ]
        }
        profile = [
            {"duration": "2s", "target": 2},
            {"duration": "2s", "target": 5},
            {"duration": "2s", "target": 10},
            {"duration": "2s", "target": 10},
            {"duration": "2s", "target": 0},
        ]

        context = build_analysis_context(summary, profile)

        self.assertEqual(1.0, context.scalingEfficiency)
        self.assertNotIn(
            "THROUGHPUT_SATURATION",
            {signal.type for signal in context.bottlenecks},
        )


if __name__ == "__main__":
    unittest.main()
