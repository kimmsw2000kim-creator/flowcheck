package com.flowcheck.dto;

import com.flowcheck.domain.ChatRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatResponseDto {
    private Long messageId;
    private java.util.UUID sessionId;
    private ChatRole role;
    private String content;
    private OffsetDateTime createdAt;
}
