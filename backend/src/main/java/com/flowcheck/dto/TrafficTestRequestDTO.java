package com.flowcheck.dto;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

@Getter
@Setter
@ToString
public class TrafficTestRequestDTO {
    private String targetUrl;
    private int vusers;
    private int duration;
    private String loadPrompt;
}