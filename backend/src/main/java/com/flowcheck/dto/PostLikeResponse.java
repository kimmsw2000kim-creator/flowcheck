package com.flowcheck.dto;

public record PostLikeResponse(
        Long postId,
        long likeCount,
        boolean liked,
        String message) {
}