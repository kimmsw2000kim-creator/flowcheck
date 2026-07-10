package com.flowcheck.dto.uiuxtest;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UiUxTestReportSubmitRequest {
    private String reportMarkdown;
}
