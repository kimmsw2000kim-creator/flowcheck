package com.flowcheck.dto.uiuxtest;

import lombok.*;
import java.util.UUID;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UIUXTestStatusResponse {
    private UUID requestId;
    private String status;
    private String targetUrl;
    private String report;
    private List<Map<String, Object>> steps;
}
