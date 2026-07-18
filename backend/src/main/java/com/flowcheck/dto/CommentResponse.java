package com.flowcheck.dto;

import java.time.LocalDateTime;
import java.util.List;

public record CommentResponse(
        Long id,
        String content,
        String writerEmail,
        String writerAvatarUrl,
        LocalDateTime createdAt,
        Long parentId,
        List<CommentResponse> replies) {
}
