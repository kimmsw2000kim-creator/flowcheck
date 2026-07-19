package com.flowcheck.dto.inquiry;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InquiryAnswerRequest(
        @NotBlank(message = "답변 내용을 입력해 주세요.")
        @Size(max = 5000, message = "답변은 5,000자 이하로 입력해 주세요.")
        String answer
) {
}
