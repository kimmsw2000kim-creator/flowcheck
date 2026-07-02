package com.flowcheck.dto.LoadTest;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class LoadTestResponse {
    private TestResults testResults;
    private UpdatedUser updatedUser;
    private DeductionDetail deductionDetail;

    @Getter
    @Builder
    public static class TestResults {
        private Integer maxTps;
        private Double avgResponse;
        private Double errorRate;
        private String bottleneckDiagnosis;
        private List<ChartPoint> points;
    }

    @Getter
    @Builder
    public static class ChartPoint {
        private String time;
        private Integer tps;
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
