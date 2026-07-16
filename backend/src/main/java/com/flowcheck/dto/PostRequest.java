package com.flowcheck.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class PostRequest {

    @NotBlank(message = "게시글 제목을 입력해주세요.")
    @Size(
            max = 100,
            message = "게시글 제목은 최대 100자까지 입력할 수 있습니다."
    )
    private String title;

    @NotBlank(message = "게시글 내용을 입력해주세요.")
    @Size(
            max = 5000,
            message = "게시글 본문은 최대 5,000자까지 입력할 수 있습니다."
    )
    private String content;
}