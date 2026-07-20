package com.flowcheck.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowcheck.domain.LoadTestReport;
import com.flowcheck.domain.TestRequest;
import com.flowcheck.dto.LoadTest.LoadTestMetricsDocument;
import com.flowcheck.dto.LoadTest.LoadTestResponse;
import com.flowcheck.repository.CouponUsageLogRepository;
import com.flowcheck.repository.CreditsLedgerRepository;
import com.flowcheck.repository.LoadTestReportRepository;
import com.flowcheck.repository.TestRequestRepository;
import com.flowcheck.repository.UserCouponRepository;
import com.flowcheck.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LoadTestServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private UserCouponRepository userCouponRepository;
    @Mock
    private CreditsLedgerRepository creditsLedgerRepository;
    @Mock
    private TestRequestRepository testRequestRepository;
    @Mock
    private LoadTestReportRepository loadTestReportRepository;
    @Mock
    private LoadTestStreamService loadTestStreamService;
    @Mock
    private CouponUsageLogRepository couponUsageLogRepository;
    @Mock
    private ApplicationEventPublisher eventPublisher;
    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private LoadTestService loadTestService;

    @Mock
    private TestRequest testRequest;
    @Mock
    private LoadTestReport report;

    private final UUID userId = UUID.randomUUID();
    private final UUID requestId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        when(testRequestRepository.findByIdAndUser_UserIdAndTestType(
                requestId,
                userId,
                "LOAD")).thenReturn(Optional.of(testRequest));
        when(testRequest.getTestStatus()).thenReturn("COMPLETED");
        when(testRequest.getTestPhase()).thenReturn("COMPLETED");
        when(testRequest.getTestProgress()).thenReturn(100);
        when(loadTestReportRepository.findByTestRequestId(requestId))
                .thenReturn(Optional.of(report));
        when(report.getAvgLatency()).thenReturn(200_000);
        when(report.getErrorRate()).thenReturn(BigDecimal.ZERO);
        when(report.getAiPerformanceReview()).thenReturn("review");
    }

    @Test
    void returnsCurrentMeasuredSeriesContract() {
        LoadTestMetricsDocument document = new LoadTestMetricsDocument(
                2,
                1,
                "MEASURED_K6",
                "COMPLETE",
                null,
                new LoadTestMetricsDocument.Summary(100L, 10.0, 15, 200.0, 350.0, 0.0),
                100,
                "A",
                "우수",
                new LoadTestMetricsDocument.ScoreBreakdown(60, 40, null),
                null,
                null,
                null,
                null,
                null,
                List.of(LoadTestResponse.ChartPoint.builder()
                        .time("00:00")
                        .elapsedSeconds(0)
                        .tps(15)
                        .avgResponse(200.0)
                        .build()));
        Map<String, Object> rawMetrics = toMap(document);
        when(report.getRawMetrics()).thenReturn(rawMetrics);

        LoadTestResponse.TestResults result = loadTestService
                .getTestResult(userId, requestId)
                .getTestResults();

        assertThat(result.getMetricsSchemaVersion()).isEqualTo(2);
        assertThat(result.getDataOrigin()).isEqualTo("MEASURED_K6");
        assertThat(result.getMetricsStatus()).isEqualTo("COMPLETE");
        assertThat(result.getTotalRequests()).isEqualTo(100L);
        assertThat(result.getMaxTps()).isEqualTo(15);
        assertThat(result.getBucketSeconds()).isEqualTo(1);
        assertThat(result.getPoints()).hasSize(1);
    }

    @Test
    void hidesLegacySyntheticPoints() {
        when(report.getTotalTps()).thenReturn(BigDecimal.TEN);
        when(report.getRawMetrics()).thenReturn(Map.of(
                "points", List.of(Map.of(
                        "time", "00:00",
                        "tps", 5,
                        "avgResponse", 100))));

        LoadTestResponse.TestResults result = loadTestService
                .getTestResult(userId, requestId)
                .getTestResults();

        assertThat(result.getMetricsSchemaVersion()).isEqualTo(1);
        assertThat(result.getDataOrigin()).isEqualTo("LEGACY_SYNTHETIC");
        assertThat(result.getMetricsStatus()).isEqualTo("LEGACY_UNVERIFIED");
        assertThat(result.getPoints()).isEmpty();
    }

    @Test
    void rejectsUnsupportedFutureSchemaWithoutExposingPoints() {
        when(report.getTotalTps()).thenReturn(BigDecimal.TEN);
        when(report.getRawMetrics()).thenReturn(Map.of(
                "schemaVersion", 99,
                "dataOrigin", "MEASURED_K6",
                "points", List.of(Map.of("time", "00:00", "tps", 999))));

        LoadTestResponse.TestResults result = loadTestService
                .getTestResult(userId, requestId)
                .getTestResults();

        assertThat(result.getMetricsSchemaVersion()).isEqualTo(99);
        assertThat(result.getDataOrigin()).isEqualTo("UNKNOWN");
        assertThat(result.getMetricsStatus()).isEqualTo("UNSUPPORTED_SCHEMA");
        assertThat(result.getPoints()).isEmpty();
        assertThat(result.getMetricsWarning()).contains("지원하지 않는");
    }

    private Map<String, Object> toMap(LoadTestMetricsDocument document) {
        return objectMapper.convertValue(
                document,
                new TypeReference<Map<String, Object>>() {
                });
    }
}
