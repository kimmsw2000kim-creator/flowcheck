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
    // 전체 엔티티가 필요할 때 사용하는 기본 조회입니다.
    Optional<UIUXTestReport> findByTestRequestId(UUID requestId);

    // 같은 요청에 리포트 row가 여러 번 생긴 경우 가장 최근 것을 진실의 원천으로 사용합니다.
    Optional<UIUXTestReport> findFirstByTestRequestIdOrderByCreatedAtDescIdDesc(UUID requestId);

    // /status 응답 조립에 필요한 필드만 가져오는 projection 조회입니다.
    // jsonb 컬럼은 인터페이스 projection으로 받을 수 있도록 text로 캐스팅한 뒤 서비스에서 ObjectMapper로 다시 파싱합니다.
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
            ORDER BY created_at DESC, uiux_report_id DESC
            LIMIT 1
            """, nativeQuery = true)
    Optional<StatusProjection> findStatusProjectionByTestRequestId(@Param("requestId") UUID requestId);

    // 대시보드/요약 화면처럼 점수만 필요한 곳에서 큰 rawLogs/report JSON을 읽지 않기 위한 경량 조회입니다.
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
            ORDER BY created_at DESC, uiux_report_id DESC
            LIMIT 1
            """, nativeQuery = true)
    Optional<ScoresProjection> findScoresProjectionByTestRequestId(@Param("requestId") UUID requestId);

    interface StatusProjection {
        // UIUXTestService.buildTestStatus가 프론트 응답 DTO로 변환하는 읽기 전용 projection입니다.
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
        // 점수 차트 등에서 사용하는 읽기 전용 projection입니다.
        Integer getOverallScore();
        Integer getScoreUsability();
        Integer getScoreAccessibility();
        Integer getScoreEfficiency();
        Integer getScorePerformance();
        Integer getScoreBestPractices();
    }
}
