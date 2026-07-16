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
    List<UIUXTestDefect> findByTestRequestId(UUID testRequestId);

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

    void deleteByTestRequestId(UUID testRequestId);

    interface StatusProjection {
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
