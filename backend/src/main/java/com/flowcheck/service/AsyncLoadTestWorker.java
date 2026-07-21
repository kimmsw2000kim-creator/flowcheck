package com.flowcheck.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowcheck.domain.LoadTestReport;
import com.flowcheck.domain.TestRequest;
import com.flowcheck.dto.LoadTest.LoadTestRequest;
import com.flowcheck.dto.LoadTest.LoadTestMetricsDocument;
import com.flowcheck.dto.LoadTest.LoadTestResponse;
import com.flowcheck.dto.LoadTest.LoadTestSubmittedEvent;
import com.flowcheck.repository.LoadTestReportRepository;
import com.flowcheck.repository.TestRequestRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
public class AsyncLoadTestWorker {

    private final TestRequestRepository testRequestRepository;
    private final LoadTestReportRepository loadTestReportRepository;
    private final LoadTestStreamService loadTestStreamService;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public AsyncLoadTestWorker(
            TestRequestRepository testRequestRepository,
            LoadTestReportRepository loadTestReportRepository,
            LoadTestStreamService loadTestStreamService,
            @Qualifier("loadTestRestClient") RestClient restClient,
            ObjectMapper objectMapper) {
        this.testRequestRepository = testRequestRepository;
        this.loadTestReportRepository = loadTestReportRepository;
        this.loadTestStreamService = loadTestStreamService;
        this.restClient = restClient;
        this.objectMapper = objectMapper;
    }

    @Value("${fastapi.url}")
    private String fastApiUrl;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void executeTestAsync(LoadTestSubmittedEvent event) {
        UUID requestId = event.requestId();
        LoadTestRequest request = event.request();

        request.setRequestId(requestId);

        TestRequest testHistory = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("부하 테스트 요청을 찾을 수 없습니다."));

        long fastApiCallStartedAt = 0L;

        try {
            testHistory.changeStatus("RUNNING");
            testHistory.changePhase("DISPATCHED_TO_FASTAPI");
            testHistory.changeProgress(15);
            testRequestRepository.save(testHistory);
            loadTestStreamService.updateProgress(requestId,
                    new com.flowcheck.dto.LoadTest.LoadTestProgressUpdateRequest(
                            "RUNNING",
                            "DISPATCHED_TO_FASTAPI",
                            15,
                            "FastAPI에 부하 테스트 실행을 전달하는 중입니다."));

            // FastAPI 호출 (여기서 몇 분이 걸리더라도 사용자 요청은 이미 202로 끝났으므로 안전함)
            fastApiCallStartedAt = System.nanoTime();
            LoadTestResponse.TestResults testResults = restClient.post()
                    .uri(fastApiUrl + "/api/load-tests")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(), (req, res) -> {
                        String responseBody;
                        try {
                            responseBody = new String(res.getBody().readAllBytes(), StandardCharsets.UTF_8);
                        } catch (Exception bodyReadException) {
                            log.warn("Failed to read FastAPI error response body", bodyReadException);
                            responseBody = "";
                        }

                        String errorMessage = buildFastApiErrorMessage(
                                res.getStatusCode().value(),
                                responseBody);
                        log.warn(
                                "FastAPI load test request failed: status={}, message={}",
                                res.getStatusCode(),
                                errorMessage);
                        throw new RuntimeException(errorMessage);
                    })
                    .body(LoadTestResponse.TestResults.class);

            if (testResults == null) {
                throw new RuntimeException("부하 테스트 결과가 반환되지 않았습니다.");
            }
            String aiReview = testResults.getBottleneckComment();
            if (aiReview == null || aiReview.isBlank()) {
                aiReview = "AI 분석 결과가 비어 있습니다.";
            }

            Double effectiveAvgTps = testResults.getAvgTps();
            if (effectiveAvgTps == null && testResults.getMaxTps() != null) {
                effectiveAvgTps = testResults.getMaxTps().doubleValue();
            }
            if (effectiveAvgTps == null) {
                effectiveAvgTps = 0.0;
            }
            Integer bucketSeconds = testResults.getBucketSeconds();
            if (bucketSeconds == null && "MEASURED_K6".equals(testResults.getDataOrigin())) {
                bucketSeconds = LoadTestMetricsDocument.DEFAULT_BUCKET_SECONDS;
            }

            LoadTestMetricsDocument.ScoreBreakdown scoreBreakdown =
                    testResults.getScoreBreakdown() == null
                            ? null
                            : new LoadTestMetricsDocument.ScoreBreakdown(
                                    testResults.getScoreBreakdown().getReliabilityScore(),
                                    testResults.getScoreBreakdown().getLatencyScore(),
                                    testResults.getScoreBreakdown().getScalabilityScore());

            LoadTestMetricsDocument metricsDocument = new LoadTestMetricsDocument(
                    LoadTestMetricsDocument.CURRENT_SCHEMA_VERSION,
                    bucketSeconds,
                    testResults.getDataOrigin(),
                    testResults.getMetricsStatus(),
                    testResults.getMetricsWarning(),
                    new LoadTestMetricsDocument.Summary(
                            testResults.getTotalRequests(),
                            effectiveAvgTps,
                            testResults.getMaxTps(),
                            testResults.getAvgResponse(),
                            testResults.getP95Response(),
                            testResults.getErrorRate()),
                    testResults.getPerformanceScore(),
                    testResults.getPerformanceGrade(),
                    testResults.getScoreLabel(),
                    scoreBreakdown,
                    testResults.getScoreVersion(),
                    testResults.getScoreStatus(),
                    testResults.getScoreTargets(),
                    testResults.getAnalysisReport(),
                    testResults.getDiagnosticMetrics(),
                    testResults.getPoints() == null ? List.of() : testResults.getPoints());

            Map<String, Object> rawMetrics = objectMapper.convertValue(
                    metricsDocument,
                    new TypeReference<Map<String, Object>>() {
                    });

            LoadTestReport report = LoadTestReport.builder()
                    .testRequest(testHistory)
                    .vusers(request.getVusers())
                    .totalTps(BigDecimal.valueOf(effectiveAvgTps))
                    .avgLatency((int) (testResults.getAvgResponse() * 1000))
                    .errorRate(BigDecimal.valueOf(testResults.getErrorRate()))
                    .rawMetrics(rawMetrics)
                    .aiPerformanceReview(aiReview)
                    .build();

            testHistory.changePhase("SAVING_REPORT");
            testHistory.changeProgress(95);
            testRequestRepository.save(testHistory);
            loadTestStreamService.updateProgress(requestId,
                    new com.flowcheck.dto.LoadTest.LoadTestProgressUpdateRequest(
                            "RUNNING",
                            "SAVING_REPORT",
                            95,
                            "결과 리포트를 저장하는 중입니다."));

            loadTestReportRepository.save(report);

            testHistory.changeStatus("COMPLETED");
            testHistory.changePhase("COMPLETED");
            testHistory.changeProgress(100);
            testRequestRepository.save(testHistory);
            loadTestStreamService.updateProgress(requestId,
                    new com.flowcheck.dto.LoadTest.LoadTestProgressUpdateRequest(
                            "COMPLETED",
                            "COMPLETED",
                            100,
                            "부하 테스트가 완료되었습니다."));

        } catch (Exception e) {
            boolean timedOut = isTimeout(e);
            long elapsedMs = fastApiCallStartedAt == 0L
                    ? 0L
                    : (System.nanoTime() - fastApiCallStartedAt) / 1_000_000;

            if (timedOut) {
                log.error(
                        "Load test FastAPI request timed out: requestId={}, elapsedMs={}, exceptionType={}",
                        requestId,
                        elapsedMs,
                        e.getClass().getSimpleName());
            } else {
                log.error("Load test failed for request {}", requestId, e);
            }
            String failureMessage = timedOut
                    ? "부하 테스트 서버의 응답 제한 시간을 초과했습니다. 잠시 후 다시 시도해 주세요."
                    : "부하 테스트 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
            loadTestStreamService.updateProgress(requestId,
                    new com.flowcheck.dto.LoadTest.LoadTestProgressUpdateRequest(
                            "FAILED",
                            timedOut ? "TIMEOUT" : "FAILED",
                            100,
                            failureMessage));
        }
    }

    private boolean isTimeout(Throwable error) {
        Throwable current = error;
        while (current != null) {
            if (current instanceof HttpTimeoutException) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private String buildFastApiErrorMessage(int statusCode, String responseBody) {
        if (statusCode == 424) {
            String detail = extractFastApiDetail(responseBody);
            if (detail != null) {
                return "대상 서버 확인 실패: " + detail;
            }
            return "대상 서버에 연결할 수 없거나 현재 정상 응답하지 않습니다.";
        }

        if (statusCode >= 400 && statusCode < 500) {
            return "부하 테스트 요청을 처리할 수 없습니다. 입력값을 확인해 주세요."
                    + " (상태 코드: " + statusCode + ")";
        }

        return "부하 테스트 처리 서버에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
                + " (상태 코드: " + statusCode + ")";
    }

    private String extractFastApiDetail(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return null;
        }

        try {
            JsonNode detailNode = objectMapper.readTree(responseBody).path("detail");
            if (detailNode.isTextual() && !detailNode.asText().isBlank()) {
                return detailNode.asText();
            }
        } catch (Exception parseException) {
            log.warn("Failed to parse FastAPI error response body", parseException);
        }

        return null;
    }
}
