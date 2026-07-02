package com.flowcheck.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TrafficTestMetrics {
    private double maxTps;
    private double avgResponse;
    private double errorRate;
}
