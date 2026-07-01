package com.flowcheck.dto.LoadTest;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class LoadTestRequest {

    @NotBlank(message = "타겟 URL은 필수 입력값입니다.")
    private String targetUrl;

    @NotNull(message = "가상 사용자 수(vusers)는 필수 입력값입니다.")
    @Min(value = 1, message = "가상 사용자 수는 1명 이상이어야 합니다.")
    private Integer vusers;

    @NotNull(message = "테스트 지속 시간(duration)은 필수 입력값입니다.")
    @Min(value = 1, message = "테스트 시간은 1초 이상이어야 합니다.")
    private Integer duration;

    private String loadPrompt;
}