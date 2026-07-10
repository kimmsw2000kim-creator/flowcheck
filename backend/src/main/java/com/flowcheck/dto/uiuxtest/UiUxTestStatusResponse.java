package com.flowcheck.dto.uiuxtest;

import lombok.*;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UiUxTestStatusResponse {
    private UUID requestId;
    private String status;
    private String targetUrl;
    private String report;
}
