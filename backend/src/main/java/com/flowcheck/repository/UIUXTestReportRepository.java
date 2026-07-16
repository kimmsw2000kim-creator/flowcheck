package com.flowcheck.repository;

import com.flowcheck.domain.UIUXTestReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UIUXTestReportRepository extends JpaRepository<UIUXTestReport, UUID> {
    Optional<UIUXTestReport> findByTestRequestId(UUID requestId);

    @Query(value = """
            SELECT
                uiux_report_id AS id,
                uiux_test_review AS uiuxTestReview,
                raw_logs::text AS rawLogs,
                video_url AS videoUrl,
                device_info::text AS deviceInfo,
                score_usability AS scoreUsability,
                score_accessibility AS scoreAccessibility,
                score_efficiency AS scoreEfficiency,
                score_performance AS scorePerformance,
                score_best_practices AS scoreBestPractices,
                overall_score AS overallScore,
                score_breakdown::text AS scoreBreakdown,
                evaluation_version AS evaluationVersion
            FROM public.uiux_test_reports
            WHERE request_id = :requestId
            """, nativeQuery = true)
    Optional<StatusProjection> findStatusProjectionByTestRequestId(@Param("requestId") UUID requestId);

    @Query(value = """
            SELECT
                overall_score AS overallScore,
                score_usability AS scoreUsability,
                score_accessibility AS scoreAccessibility,
                score_efficiency AS scoreEfficiency,
                score_performance AS scorePerformance,
                score_best_practices AS scoreBestPractices
            FROM public.uiux_test_reports
            WHERE request_id = :requestId
            """, nativeQuery = true)
    Optional<ScoresProjection> findScoresProjectionByTestRequestId(@Param("requestId") UUID requestId);

    interface StatusProjection {
        UUID getId();
        String getUiuxTestReview();
        String getRawLogs();
        String getVideoUrl();
        String getDeviceInfo();
        Integer getScoreUsability();
        Integer getScoreAccessibility();
        Integer getScoreEfficiency();
        Integer getScorePerformance();
        Integer getScoreBestPractices();
        Integer getOverallScore();
        String getScoreBreakdown();
        String getEvaluationVersion();
    }

    interface ScoresProjection {
        Integer getOverallScore();
        Integer getScoreUsability();
        Integer getScoreAccessibility();
        Integer getScoreEfficiency();
        Integer getScorePerformance();
        Integer getScoreBestPractices();
    }
}
