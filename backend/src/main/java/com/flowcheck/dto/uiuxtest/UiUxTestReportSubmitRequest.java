package com.flowcheck.dto.uiuxtest;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UIUXTestReportSubmitRequest {
    private String reportMarkdown;
}
