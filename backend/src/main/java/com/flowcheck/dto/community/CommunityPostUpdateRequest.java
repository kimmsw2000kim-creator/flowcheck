package com.flowcheck.dto.community;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/*
 * 커뮤니티 게시글 수정 요청입니다.
 *
 * 게시글 카테고리와 연결된 사이트 또는 테스트는 변경하지 않고,
 * 제목과 내용만 수정할 수 있도록 제한합니다.
 */
public record CommunityPostUpdateRequest(

        @NotBlank(message = "게시글 제목은 필수입니다.")
        @Size(
                max = 100,
                message = "게시글 제목은 100자 이하여야 합니다."
        )
        String title,

        @NotBlank(message = "게시글 내용은 필수입니다.")
        String content
) {
}