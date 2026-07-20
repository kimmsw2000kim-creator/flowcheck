package com.flowcheck.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatRequestDto {
    private UUID sessionId; // If null, create a new session

    @NotBlank(message = "메시지는 비어 있을 수 없습니다.")
    @Size(max = 4000, message = "메시지는 4000자 이하로 입력해 주세요.")
    private String message;
}
