package com.flowcheck.dto.community;

import java.time.OffsetDateTime;
import java.util.List;

public record CommunityPostCommentResponse(
        Long id,
        String content,
        String writerEmail,
        String writerAvatarUrl,
        OffsetDateTime createdAt,
        Long parentId,
        List<CommunityPostCommentResponse> replies
) {
}
