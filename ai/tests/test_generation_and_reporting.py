import json
import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from load_test.exceptions import LoadTestGenerationError
from load_test.report_generator import (
    build_fallback_analysis,
    build_markdown_report,
    generate_analysis_report,
    sanitize_analysis_markdown,
)
from load_test.result_processor import calculate_performance_assessment
from load_test.script_generator import (
    build_default_stages,
    clean_k6_script,
    generate_k6_script,
    load_default_k6_template,
)


def gemini_client(response_text=None, side_effect=None):
    generate_content = AsyncMock(
        return_value=SimpleNamespace(text=response_text),
        side_effect=side_effect,
    )
    return SimpleNamespace(
        aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate_content))
    )


class ScriptGeneratorTest(unittest.IsolatedAsyncioTestCase):
    def test_clean_k6_script_removes_markdown_fences(self):
        self.assertEqual("export default {}", clean_k6_script("```js\nexport default {}\n```"))

    def test_default_stages_ramp_up_hold_and_ramp_down(self):
        stages = build_default_stages(vusers=17, duration=42)

        self.assertEqual([5, 9, 17, 17, 0], [stage["target"] for stage in stages])
        self.assertEqual(
            ["8400ms", "8400ms", "8400ms", "12600ms", "4200ms"],
            [stage["duration"] for stage in stages],
        )
        self.assertEqual(
            42_000,
            sum(int(str(stage["duration"]).removesuffix("ms")) for stage in stages),
        )

    async def test_empty_prompts_render_default_template_without_llm(self):
        target_url = 'https://example.com/path?value="quoted"\\next\nline'

        for load_prompt in ("", "   ", None):
            with self.subTest(load_prompt=load_prompt):
                client = gemini_client("must not be used")
                result = await generate_k6_script(
                    client,
                    target_url,
                    17,
                    42,
                    load_prompt,
                )

                self.assertIn('stages: [{"duration": "8400ms", "target": 5}', result)
                self.assertIn('{"duration": "4200ms", "target": 0}]', result)
                self.assertNotIn("vus:", result)
                self.assertIn("discardResponseBodies: true", result)
                self.assertIn(f"http.get({json.dumps(target_url)})", result)
                client.aio.models.generate_content.assert_not_awaited()

    async def test_non_empty_prompt_calls_llm_and_returns_clean_code(self):
        client = gemini_client("```javascript\nexport default {}\n```")
        result = await generate_k6_script(
            client,
            "https://example.com",
            2,
            10,
            "점진적으로 부하를 증가시켜 주세요.",
        )
        self.assertEqual("export default {}", result)
        call = client.aio.models.generate_content.await_args.kwargs
        self.assertEqual("gemini-3.5-flash", call["model"])
        self.assertIn("점진적으로 부하를 증가", call["contents"])

    async def test_template_read_failure_is_wrapped(self):
        load_default_k6_template.cache_clear()
        try:
            with patch(
                "load_test.script_generator.Path.read_text",
                side_effect=OSError("missing template"),
            ):
                with self.assertRaisesRegex(LoadTestGenerationError, "기본 k6"):
                    await generate_k6_script(
                        gemini_client(),
                        "https://example.com",
                        2,
                        10,
                        "",
                    )
        finally:
            load_default_k6_template.cache_clear()

    async def test_generate_k6_script_wraps_client_failure(self):
        with self.assertRaises(LoadTestGenerationError):
            await generate_k6_script(
                gemini_client(side_effect=ValueError("failed")),
                "https://example.com",
                2,
                10,
                "사용자 정의 시나리오",
            )


class ReportGeneratorTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.summary = {
            "real_request_count": 420,
            "real_tps": 10,
            "max_tps": 25,
            "real_avg_response": 250,
            "p95_response": 480,
            "real_error_rate": 0,
            "is_server_dead": False,
        }
        self.assessment = calculate_performance_assessment(self.summary)

    def test_sanitize_accepts_only_expected_sections(self):
        source = """Intro
## 핵심 진단
- 첫 진단
- 둘째 진단
- 무시할 진단
## 우선 조치
1. 첫 조치
2) 둘째 조치
3. 무시할 조치"""
        result = sanitize_analysis_markdown(source)
        self.assertEqual(3, result.count("진단"))
        self.assertNotIn("무시할", result)

    def test_sanitize_rejects_invalid_shape(self):
        self.assertIsNone(sanitize_analysis_markdown("분석 결과 없음"))

    def test_markdown_report_uses_distinct_average_peak_and_tail_metrics(self):
        report = build_markdown_report(self.summary, self.assessment, "분석")

        self.assertIn("총 요청 수 | **420건**", report)
        self.assertIn("평균 TPS | **10.00 req/s**", report)
        self.assertIn("최대 TPS | **25 req/s**", report)
        self.assertIn("p95 응답시간 | **480.00 ms**", report)

    async def test_generate_analysis_returns_valid_sanitized_report(self):
        text = "## 핵심 진단\n- 정상\n\n## 우선 조치\n1. 유지"
        result = await generate_analysis_report(
            gemini_client(text),
            self.summary,
            self.assessment,
            "https://example.com",
            2,
            10,
            "",
        )
        self.assertEqual(text, result)

    async def test_generate_analysis_falls_back_for_invalid_or_long_output(self):
        fallback = build_fallback_analysis(self.summary)
        with self.assertLogs("load_test.report_generator", level="WARNING") as logs:
            invalid = await generate_analysis_report(
                gemini_client("invalid"), self.summary, self.assessment, "url", 1, 1, ""
            )
        long_text = "## 핵심 진단\n- " + ("가" * 1500) + "\n## 우선 조치\n1. 조치"
        oversized = await generate_analysis_report(
            gemini_client(long_text), self.summary, self.assessment, "url", 1, 1, ""
        )
        self.assertEqual(fallback, invalid)
        self.assertEqual(fallback, oversized)
        self.assertTrue(any("model output was invalid" in message for message in logs.output))

    async def test_generate_analysis_falls_back_on_client_failure(self):
        with self.assertLogs("load_test.report_generator", level="ERROR") as logs:
            result = await generate_analysis_report(
                gemini_client(side_effect=RuntimeError("failed")),
                self.summary,
                self.assessment,
                "url",
                1,
                1,
                "",
            )
        self.assertEqual(build_fallback_analysis(self.summary), result)
        self.assertTrue(any("model generation failed" in message for message in logs.output))


if __name__ == "__main__":
    unittest.main()
