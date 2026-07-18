package com.flowcheck.dto.admin;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record AdminStatsResponse(
        long totalUsers,
        long activeUsers,
        long verifiedDomains,
        long totalTests,
        long completedTests,
        long creditsConsumed,
        List<DailyStats> dailyStats,
        OffsetDateTime generatedAt
) {
    public record DailyStats(
            LocalDate date,
            long newUsers,
            long testsRun,
            long creditsConsumed
    ) {
    }
}
