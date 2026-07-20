package com.flowcheck.repository;

import com.flowcheck.domain.UIUXTestDefect;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface UIUXTestDefectRepository extends JpaRepository<UIUXTestDefect, Long> {
    // 특정 테스트 요청에 속한 결함 전체를 엔티티로 조회합니다.
    List<UIUXTestDefect> findByTestRequestId(UUID testRequestId);

    // 상태 조회 화면에 필요한 결함 필드만 가져옵니다.
    // evidence는 jsonb라 projection 호환을 위해 text로 캐스팅하고, 서비스에서 Map으로 다시 파싱합니다.
    @Query(value = """
            SELECT
                id,
                category,
                selector,
                severity,
                description,
                timestamp_offset AS timestampOffset,
                source,
                rule_id AS ruleId,
                evidence::text AS evidence,
                recommendation,
                screenshot_url AS screenshotUrl
            FROM public.uiux_test_defects
            WHERE request_id = :requestId
            ORDER BY timestamp_offset ASC, id ASC
            """, nativeQuery = true)
    List<StatusProjection> findStatusProjectionsByTestRequestId(@Param("requestId") UUID requestId);

    // 최종 리포트가 다시 저장될 때 이전 결함 목록을 지우고 새 결함 목록으로 교체합니다.
    void deleteByTestRequestId(UUID testRequestId);

    interface StatusProjection {
        // UIUXTestStatusResponse.DefectDto로 변환되는 읽기 전용 결함 projection입니다.
        Long getId();
        String getCategory();
        String getSelector();
        String getSeverity();
        String getDescription();
        Integer getTimestampOffset();
        String getSource();
        String getRuleId();
        String getEvidence();
        String getRecommendation();
        String getScreenshotUrl();
    }
}
