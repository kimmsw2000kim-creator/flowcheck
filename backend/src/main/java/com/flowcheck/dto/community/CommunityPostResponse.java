package com.flowcheck.dto.community;

import com.flowcheck.domain.CommunityPost;
import com.flowcheck.domain.PostCategory;

import java.time.OffsetDateTime;
import java.util.UUID;

/*
 * 커뮤니티 게시글을 프론트엔드에 전달하는 응답 DTO입니다.
 *
 * JPA 엔티티를 직접 반환하지 않고 화면에 필요한 값만 제공합니다.
 */
public record CommunityPostResponse(
        Long id,
        PostCategory category,
        String title,
        String content,
        String writerEmail,
        String promoUrl,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        long likeCount,
        long commentCount,
        Long siteId,
        UUID testRequestId
) {

    /*
     * CommunityPost 엔티티를 API 응답 형태로 변환합니다.
     *
     * 좋아요 수, 댓글 수, 테스트 요청 ID는 다른 테이블에서
     * 조회해야 하므로 매개변수로 전달받습니다.
     */
    public static CommunityPostResponse from(
            CommunityPost post,
            long likeCount,
            long commentCount,
            UUID testRequestId
    ) {
        /*
         * 테스트 공유 게시글에는 사이트가 없을 수 있으므로
         * null 여부를 먼저 확인합니다.
         */
        Long siteId = post.getSite() == null
                ? null
                : post.getSite().getId();

        return new CommunityPostResponse(
                post.getPostId(),
                post.getCategory(),
                post.getTitle(),
                post.getContent(),
                post.getUser().getEmail(),
                post.getPromoUrl(),
                post.getCreatedAt(),
                post.getUpdatedAt(),
                likeCount,
                commentCount,
                siteId,
                testRequestId
        );
    }
}