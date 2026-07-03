package com.flowcheck.dto.uitest;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UiTestStartRequest {
    @NotBlank(message = "Target URL is required")
    private String targetUrl;
}
