package com.flowcheck.dto.LoadTest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Setter
@Getter
@NoArgsConstructor
public class LoadTestRequest {

    private UUID requestId;

    @NotBlank(message = "타겟 URL은 필수 입력값입니다.")
    private String targetUrl;

    @NotNull(message = "가상 사용자 수(vusers)는 필수 입력값입니다.")
    @Min(value = 1, message = "가상 사용자 수는 1명 이상이어야 합니다.")
    private Integer vusers;

    @NotNull(message = "테스트 지속 시간(duration)은 필수 입력값입니다.")
    @Min(value = 1, message = "테스트 시간은 1초 이상이어야 합니다.")
    @Max(value = 600, message = "테스트 시간은 600초 이하여야 합니다.")
    private Integer duration;

    private String loadPrompt;

    @Valid
    private PerformanceTargets performanceTargets;

    @Setter
    @Getter
    @NoArgsConstructor
    public static class PerformanceTargets {
        @DecimalMin(value = "0.01", message = "목표 TPS는 0보다 커야 합니다.")
        private Double targetTps;

        @DecimalMin(value = "0.01", message = "목표 p95 응답시간은 0보다 커야 합니다.")
        private Double targetP95Ms;

        @DecimalMin(value = "0.0", message = "최대 오류율은 0 이상이어야 합니다.")
        @DecimalMax(value = "100.0", message = "최대 오류율은 100 이하여야 합니다.")
        private Double maxErrorRate;
    }
}
