package com.flowcheck.dto.uiuxtest;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UIUXTestStartRequest {
    // 사용자가 UI/UX 테스트를 시작할 때 프론트에서 보내는 최소 입력입니다.
    // targetUrl은 실제 브라우저가 접속할 대상이고, promptInput은 향후 사용자 지시 확장용 필드입니다.
    private String targetUrl;
    private String promptInput;
}
