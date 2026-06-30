package com.flowcheck.dto.LoadTest;

import lombok.Builder;

import java.util.List;

@Builder
public record TestResults(
        double maxTps,
        double avgResponse,
        double errorRate,
        String bottleneckDiagnosis,
        List<ChartPoint> points
) {
}
