package com.flowcheck.dto.LoadTest;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class LoadTestResponse {
    private String status;
    private String phase;
    private Integer progress;
    private String message;
    private TestResults testResults;
    private UpdatedUser updatedUser;
    private DeductionDetail deductionDetail;

    @Getter
    @Builder
    public static class TestResults {
        private Long totalRequests;
        private Double avgTps;
        private Integer maxTps;
        private Double avgResponse;
        private Double p95Response;
        private Double errorRate;
        private Integer performanceScore;
        private String performanceGrade;
        private String scoreLabel;
        private ScoreBreakdown scoreBreakdown;
        @JsonAlias("bottleneck_comment")
        private String bottleneckComment;
        private List<ChartPoint> points;
        private String metricsStatus;
        private String metricsWarning;
        private String dataOrigin;
        private Integer bucketSeconds;
    }

    @Getter
    @Builder
    public static class ScoreBreakdown {
        private Integer reliabilityScore;
        private Integer latencyScore;
    }

    @Getter
    @Builder
    public static class ChartPoint {
        private String time;
        private Integer elapsedSeconds;
        private Integer tps;
        private Double avgResponse;
        private Double p95Response;
        private Double errorRate;
        private Integer vus;
    }

    @Getter
    @Builder
    public static class UpdatedUser {
        private Integer coupons;
        private Integer balance;
    }

    @Getter
    @Builder
    public static class DeductionDetail {
        private String type;
        private Long ledgerId;
    }
}
