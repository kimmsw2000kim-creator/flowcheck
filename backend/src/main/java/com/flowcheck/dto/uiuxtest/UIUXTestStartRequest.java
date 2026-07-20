package com.flowcheck.dto.uiuxtest;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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
    @NotBlank(message = "테스트 대상 URL은 필수입니다.")
    @Size(max = 2048, message = "테스트 대상 URL은 2048자 이하로 입력해 주세요.")
    private String targetUrl;

    @Size(max = 2000, message = "추가 요청사항은 2000자 이하로 입력해 주세요.")
    private String promptInput;
}
