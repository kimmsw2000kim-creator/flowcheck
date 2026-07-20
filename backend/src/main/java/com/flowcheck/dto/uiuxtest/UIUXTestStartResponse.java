package com.flowcheck.dto.uiuxtest;

import lombok.*;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UIUXTestStartResponse {
    // 시작 API는 실제 검사 완료를 기다리지 않고 requestId만 즉시 반환합니다.
    // 프론트는 이 ID로 /status polling, /vnc-token 요청, 취소 요청을 이어갑니다.
    private UUID requestId;
    private String status;
    private String message;
}
