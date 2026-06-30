package com.flowcheck.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TrafficTestStatusDTO {
    private String status;
    private TrafficTestMetrics metrics;
    private String chartData;
}
