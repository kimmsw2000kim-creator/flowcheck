package com.flowcheck.dto.uitest;

import lombok.*;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UiTestStatusResponse {
    private UUID requestId;
    private String status;
    private String targetUrl;
    private String report;
    private List<UiTestStepDTO> steps;
}
