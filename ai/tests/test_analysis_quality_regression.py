import json
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from load_test.analysis_engine import build_analysis_context
from load_test.models import PerformanceTargets
from load_test.result_processor import calculate_performance_assessment_v2


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "load_analysis_scenarios.json"


class AnalysisQualityRegressionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scenarios = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

    def summary_for(self, scenario_name):
        points = self.scenarios[scenario_name]["points"]
        return {
            "real_request_count": sum(point["tps"] for point in points),
            "real_tps": (
                sum(point["tps"] for point in points) / len(points)
                if points
                else 0
            ),
            "real_avg_response": 100,
            "real_error_rate": 0,
            "p95_response": 150 if points else None,
            "data_origin": "MEASURED_K6" if points else "NOT_COLLECTED",
            "chart_points": points,
            "is_server_dead": not points,
        }

    def test_expected_bottleneck_signals_are_stable(self):
        for scenario_name in ("healthy", "saturationTailAndErrors", "unavailable"):
            with self.subTest(scenario=scenario_name):
                context = build_analysis_context(self.summary_for(scenario_name))
                self.assertEqual(
                    set(self.scenarios[scenario_name]["expectedSignals"]),
                    {signal.type for signal in context.bottlenecks},
                )

    def test_every_bottleneck_has_numeric_evidence_without_root_cause_claims(self):
        context = build_analysis_context(self.summary_for("saturationTailAndErrors"))

        for signal in context.bottlenecks:
            self.assertRegex(signal.evidence, r"\d")
            self.assertNotRegex(signal.evidence, r"CPU가 원인|DB가 원인|네트워크가 원인")

    def test_partial_series_falls_back_to_v1_score(self):
        summary = self.summary_for("partial")
        context = build_analysis_context(summary)

        result = calculate_performance_assessment_v2(summary, context, None, duration=10)

        self.assertEqual(self.scenarios["partial"]["expectedCoverage"], context.coverageRatio)
        self.assertEqual(1, result.version)
        self.assertEqual("FALLBACK_INSUFFICIENT_DATA", result.status)

    def test_healthy_series_supports_default_and_custom_slo_scores(self):
        summary = self.summary_for("healthy")
        context = build_analysis_context(summary)

        default_score = calculate_performance_assessment_v2(summary, context, None, duration=10)
        custom_score = calculate_performance_assessment_v2(
            summary,
            context,
            PerformanceTargets(targetTps=100, targetP95Ms=100, maxErrorRate=1),
            duration=10,
        )

        self.assertEqual(2, default_score.version)
        self.assertEqual("DEFAULT_SLO", default_score.status)
        self.assertEqual("CUSTOM_SLO", custom_score.status)
        self.assertLess(custom_score.assessment.score, default_score.assessment.score)

    def test_unavailable_series_never_receives_v2_score(self):
        summary = self.summary_for("unavailable")
        context = build_analysis_context(summary)

        result = calculate_performance_assessment_v2(summary, context, None, duration=10)

        self.assertEqual(1, result.version)
        self.assertEqual([], context.stages)


if __name__ == "__main__":
    unittest.main()
