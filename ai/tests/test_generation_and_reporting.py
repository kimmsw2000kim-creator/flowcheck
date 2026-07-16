import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from load_test.exceptions import LoadTestGenerationError
from load_test.report_generator import (
    build_fallback_analysis,
    generate_analysis_report,
    sanitize_analysis_markdown,
)
from load_test.result_processor import calculate_performance_assessment
from load_test.script_generator import clean_k6_script, generate_k6_script


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

    async def test_generate_k6_script_returns_clean_code(self):
        client = gemini_client("```javascript\nexport default {}\n```")
        result = await generate_k6_script(client, "https://example.com", 2, 10, "")
        self.assertEqual("export default {}", result)
        call = client.aio.models.generate_content.await_args.kwargs
        self.assertEqual("gemini-3.5-flash", call["model"])

    async def test_generate_k6_script_wraps_client_failure(self):
        with self.assertRaises(LoadTestGenerationError):
            await generate_k6_script(
                gemini_client(side_effect=ValueError("failed")),
                "https://example.com",
                2,
                10,
                "",
            )


class ReportGeneratorTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.summary = {
            "real_tps": 10,
            "real_avg_response": 250,
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
        invalid = await generate_analysis_report(
            gemini_client("invalid"), self.summary, self.assessment, "url", 1, 1, ""
        )
        long_text = "## 핵심 진단\n- " + ("가" * 1500) + "\n## 우선 조치\n1. 조치"
        oversized = await generate_analysis_report(
            gemini_client(long_text), self.summary, self.assessment, "url", 1, 1, ""
        )
        self.assertEqual(fallback, invalid)
        self.assertEqual(fallback, oversized)

    async def test_generate_analysis_falls_back_on_client_failure(self):
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


if __name__ == "__main__":
    unittest.main()
