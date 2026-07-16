import asyncio
import logging
from typing import Any

from .aws_executor import run_k6_aws_fargate
from .models import LoadTestProgressUpdate, TestResultsResponse
from .progress_publisher import publish_progress
from .report_generator import generate_analysis_report, build_markdown_report
from .result_processor import build_chart_points, calculate_performance_assessment
from .script_generator import generate_k6_script
from .target_validator import validate_target_server

logger = logging.getLogger(__name__)


async def run_load_test_pipeline(client: Any, request: Any) -> TestResultsResponse:
    await validate_target_server(request.targetUrl)

    request_id = getattr(request, "requestId", None)

    await publish_progress(
        request_id,
        LoadTestProgressUpdate(
            status="RUNNING",
            phase="GENERATING_SCRIPT",
            progress=15,
            message="k6 스크립트를 준비하는 중입니다.",
        ),
    )

    generated_script = await generate_k6_script(
        client=client,
        target_url=request.targetUrl,
        vusers=request.vusers,
        duration=request.duration,
        load_prompt=request.loadPrompt or "",
    )

    await publish_progress(
        request_id,
        LoadTestProgressUpdate(
            status="RUNNING",
            phase="PROVISIONING_INFRA",
            progress=35,
            message="클라우드 부하 테스트 인프라를 프로비저닝하고 실행 중입니다. (약 1분 소요)",
        ),
    )

    logger.debug("Prepared k6 script:\n%s", generated_script)

    summary = await asyncio.to_thread(
        run_k6_aws_fargate,
        generated_script,
        request.duration,
        request_id,
    )

    await publish_progress(
        request_id,
        LoadTestProgressUpdate(
            status="RUNNING",
            phase="PROCESSING_RESULTS",
            progress=80,
            message="실행 결과를 해석하고 보고서를 작성하는 중입니다.",
        ),
    )

    chart_points = build_chart_points(
        duration=request.duration,
        real_tps=summary["real_tps"],
        real_avg_response=summary["real_avg_response"],
        is_server_dead=summary["is_server_dead"],
    )

    assessment = calculate_performance_assessment(summary)
    analysis = await generate_analysis_report(
        client=client,
        summary=summary,
        assessment=assessment,
        target_url=request.targetUrl,
        vusers=request.vusers,
        duration=request.duration,
        load_prompt=request.loadPrompt or "",
    )
    markdown_report = build_markdown_report(summary, assessment, analysis)

    await publish_progress(
        request_id,
        LoadTestProgressUpdate(
            status="RUNNING",
            phase="RESULT_READY",
            progress=95,
            message="결과를 전달할 준비가 되었습니다.",
        ),
    )

    return TestResultsResponse(
        maxTps=int(summary["real_tps"]),
        avgResponse=round(summary["real_avg_response"], 2),
        errorRate=round(summary["real_error_rate"], 2),
        performanceScore=assessment.score,
        performanceGrade=assessment.grade,
        scoreLabel=assessment.label,
        scoreBreakdown=assessment.breakdown,
        bottleneckComment=markdown_report,
        points=chart_points,
    )
