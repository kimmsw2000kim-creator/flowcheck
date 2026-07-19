package com.flowcheck.dto.mypage;

import java.time.OffsetDateTime;

public record MypageCommunityActivityResponseDTO(
        String activityType,
        String boardType,
        String category,
        Long activityId,
        Long postId,
        String title,
        String content,
        OffsetDateTime createdAt
) {
}
