package com.flowcheck.dto.LoadTest;

import java.util.List;

/**
 * load_test_reports.raw_metrics JSONB에 저장되는 버전형 문서입니다.
 *
 * <p>스키마가 바뀌면 기존 필드의 의미를 덮어쓰지 않고 schemaVersion을 올립니다.</p>
 */
public record LoadTestMetricsDocument(
        Integer schemaVersion,
        Integer bucketSeconds,
        String dataOrigin,
        String metricsStatus,
        String metricsWarning,
        Summary summary,
        Integer performanceScore,
        String performanceGrade,
        String scoreLabel,
        ScoreBreakdown scoreBreakdown,
        Integer scoreVersion,
        String scoreStatus,
        LoadTestResponse.ScoreTargets scoreTargets,
        LoadTestResponse.AnalysisReport analysisReport,
        List<LoadTestResponse.ChartPoint> points
) {
    public static final int MIN_SUPPORTED_SCHEMA_VERSION = 2;
    public static final int CURRENT_SCHEMA_VERSION = 3;
    public static final int DEFAULT_BUCKET_SECONDS = 1;

    public record Summary(
            Long totalRequests,
            Double avgTps,
            Integer maxTps,
            Double avgResponse,
            Double p95Response,
            Double errorRate
    ) {
    }

    public record ScoreBreakdown(
            Integer reliabilityScore,
            Integer latencyScore,
            Integer scalabilityScore
    ) {
    }
}
