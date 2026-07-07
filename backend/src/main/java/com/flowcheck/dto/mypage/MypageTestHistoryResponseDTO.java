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
        String description,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
