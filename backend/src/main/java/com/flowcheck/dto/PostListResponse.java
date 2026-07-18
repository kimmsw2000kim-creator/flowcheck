package com.flowcheck.dto;

import java.time.LocalDateTime;

public record PostListResponse(
        Long id,
        String title,
        String content,
        String writerEmail,
        String writerAvatarUrl,
        LocalDateTime createdAt,
        int likeCount,
        int commentCount) {
}
