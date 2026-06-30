package com.flowcheck.dto.LoadTest;

public record ChartPoint(
        String time,
        int users,
        double tps,
        double avg_response
) {
}
