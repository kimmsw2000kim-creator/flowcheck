package com.flowcheck.dto.mypage;

import java.time.OffsetDateTime;
import java.util.UUID;

public record MypageTestHistoryResponseDTO(
        UUID requestId,
        String testType,
        String testName,
        String targetUrl,
        String status,
        String phase,
        Integer progress,
        Integer overallScore,
        Integer scoreUsability,
        Integer scoreAccessibility,
        Integer scoreEfficiency,
        Integer scorePerformance,
        Integer scoreBestPractices,
        String description,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
        Long linkedPostId
) {
}
