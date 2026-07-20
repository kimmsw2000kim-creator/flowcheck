package com.flowcheck.dto.community;

import com.flowcheck.domain.PostCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/*
 * 커뮤니티 게시글 작성 요청입니다.
 *
 * userId와 email은 클라이언트가 보내지 않습니다.
 * 작성자는 로그인 JWT에서 확인합니다.
 */
public record CommunityPostRequest(

        @NotNull(message = "게시글 카테고리는 필수입니다.")
        PostCategory category,

        @NotBlank(message = "게시글 제목은 필수입니다.")
        @Size(max = 100, message = "게시글 제목은 100자 이하여야 합니다.")
        String title,

        /*
        * TEST_SHARE에서는 빈 문자열을 허용합니다.
        * null은 허용하지 않고 DB에는 빈 문자열로 저장합니다.
        */
        @NotNull(message = "게시글 내용 값이 필요합니다.")
        @Size(max = 5000, message = "게시글 내용은 5,000자 이하여야 합니다.")
        String content,

                /*
                * SITE_PROMOTION에서 사용할 등록 사이트 ID입니다.
                * 다른 카테고리에서는 null이어야 합니다.
                */
                Long siteId,

                /*
                * TEST_SHARE에서 연결할 테스트 요청 ID입니다.
                * 다른 카테고리에서는 null이어야 합니다.
                */
                UUID testRequestId
        ) {
}
