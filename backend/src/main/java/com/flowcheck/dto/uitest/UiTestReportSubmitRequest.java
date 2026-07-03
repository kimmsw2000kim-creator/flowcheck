package com.flowcheck.dto.uitest;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UiTestReportSubmitRequest {
    private String reportMarkdown;
}
