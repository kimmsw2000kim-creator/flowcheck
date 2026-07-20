package com.flowcheck.dto.LoadTest;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

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
    @NoArgsConstructor
    @AllArgsConstructor
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
        private Integer scoreVersion;
        private String scoreStatus;
        private ScoreTargets scoreTargets;
        @JsonAlias("bottleneck_comment")
        private String bottleneckComment;
        private AnalysisReport analysisReport;
        private DiagnosticMetrics diagnosticMetrics;
        private List<ChartPoint> points;
        private String metricsStatus;
        private String metricsWarning;
        private String dataOrigin;
        private Integer bucketSeconds;
        private Integer metricsSchemaVersion;
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ScoreBreakdown {
        private Integer reliabilityScore;
        private Integer latencyScore;
        private Integer scalabilityScore;
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ScoreTargets {
        private Double targetTps;
        private Double targetP95Ms;
        private Double maxErrorRate;
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AnalysisReport {
        private Integer schemaVersion;
        private String generationSource;
        private String verdict;
        private List<StageAnalysis> stages;
        private List<BottleneckSignal> bottlenecks;
        private List<AnalysisAction> actions;
        private List<String> limitations;
        private Double sustainableTps;
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StageAnalysis {
        private String stage;
        private Integer startSecond;
        private Integer endSecond;
        private Integer minVus;
        private Integer maxVus;
        private Double avgVus;
        private Integer requestCount;
        private Double avgTps;
        private Integer maxTps;
        private Double tpsPerVu;
        private Double avgResponse;
        private Double p95Response;
        private Double errorRate;
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BottleneckSignal {
        private String type;
        private String severity;
        private Integer firstObservedSecond;
        private String evidence;
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AnalysisAction {
        private Integer priority;
        private String title;
        private String rationale;
        private String evidence;
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DiagnosticMetrics {
        private TimingBreakdown timing;
        private Integer iterations;
        private Integer droppedIterations;
        private Double checkFailureRate;
        private java.util.Map<String, Integer> statusCodes;
        private List<RequestDiagnostic> requests;
        private Integer executionExitCode;
        private List<String> thresholdFailures;
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TimingBreakdown {
        private Double blockedMs;
        private Double connectingMs;
        private Double tlsHandshakingMs;
        private Double sendingMs;
        private Double waitingMs;
        private Double receivingMs;
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RequestDiagnostic {
        private String name;
        private Integer requests;
        private Double avgResponse;
        private Double errorRate;
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
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
