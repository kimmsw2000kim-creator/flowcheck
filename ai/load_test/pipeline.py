import asyncio
import logging
from typing import Any

from .aws_executor import run_k6_aws_fargate
from .models import LoadTestProgressUpdate, PerformanceTargets, TestResultsResponse
from .progress_publisher import publish_progress
from .analysis_engine import build_analysis_context
from .report_generator import (
    build_markdown_report,
    generate_structured_analysis_report,
    render_structured_analysis,
)
from .result_processor import calculate_performance_assessment_v2
from .script_generator import build_default_stages, generate_k6_script
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

    declared_profile = (
        build_default_stages(request.vusers, request.duration)
        if not (request.loadPrompt or "").strip()
        else None
    )
    analysis_context = build_analysis_context(summary, declared_profile)
    requested_targets = getattr(request, "performanceTargets", None)
    performance_targets = (
        PerformanceTargets.model_validate(requested_targets)
        if requested_targets is not None
        else PerformanceTargets()
    )
    score_result = calculate_performance_assessment_v2(
        summary,
        analysis_context,
        performance_targets,
        request.duration,
    )
    assessment = score_result.assessment
    structured_analysis = await generate_structured_analysis_report(
        client=client,
        summary=summary,
        assessment=assessment,
        target_url=request.targetUrl,
        vusers=request.vusers,
        duration=request.duration,
        load_prompt=request.loadPrompt or "",
        context=analysis_context,
    )
    structured_analysis.sustainableTps = score_result.sustainableTps
    analysis = render_structured_analysis(structured_analysis)
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
        totalRequests=int(summary.get("real_request_count", 0)),
        avgTps=round(summary["real_tps"], 2),
        maxTps=summary.get("max_tps"),
        avgResponse=round(summary["real_avg_response"], 2),
        p95Response=summary.get("p95_response"),
        errorRate=round(summary["real_error_rate"], 2),
        performanceScore=assessment.score,
        performanceGrade=assessment.grade,
        scoreLabel=assessment.label,
        scoreBreakdown=assessment.breakdown,
        scoreVersion=score_result.version,
        scoreStatus=score_result.status,
        scoreTargets=score_result.targets,
        bottleneckComment=markdown_report,
        analysisReport=structured_analysis,
        diagnosticMetrics=summary.get("diagnostic_metrics"),
        points=summary.get("chart_points", []),
        metricsStatus=summary.get("metrics_status", "UNAVAILABLE"),
        metricsWarning=summary.get(
            "metrics_warning",
            "k6 실측 시계열이 없어 전체 요약 지표만 제공합니다.",
        ),
        dataOrigin=summary.get("data_origin", "NOT_COLLECTED"),
        bucketSeconds=(
            1 if summary.get("data_origin") == "MEASURED_K6" else None
        ),
    )
