package com.flowcheck.dto.inquiry;

import com.flowcheck.domain.Inquiry;

import java.time.OffsetDateTime;
import java.util.UUID;

public record InquiryResponse(
        Long id,
        UUID userId,
        String userEmail,
        String title,
        String content,
        String status,
        String answer,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        OffsetDateTime answeredAt
) {
    public static InquiryResponse from(Inquiry inquiry) {
        return new InquiryResponse(
                inquiry.getInquiryId(),
                inquiry.getUser().getUserId(),
                inquiry.getUser().getEmail(),
                inquiry.getTitle(),
                inquiry.getContent(),
                inquiry.getStatus(),
                inquiry.getAnswer(),
                inquiry.getCreatedAt(),
                inquiry.getUpdatedAt(),
                inquiry.getAnsweredAt()
        );
    }
}
