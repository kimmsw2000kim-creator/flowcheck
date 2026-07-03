package com.flowcheck.dto.uitest;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UiTestStepDTO {
    private Integer step;
    private String url;
    private String action;
    private String selector;
    private String text;
    private String reason;
    private String error;
}
