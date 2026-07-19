package com.flowcheck.dto.community;

public record CommunityPostLikeResponse(
        Long postId,
        long likeCount,
        boolean liked,
        String message
) {
}
