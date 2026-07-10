package com.flowcheck.dto.uiuxtest;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UiUxTestStartRequest {
    private String targetUrl;
    private String promptInput;
}