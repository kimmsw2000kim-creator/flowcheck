package com.flowcheck.service;

import com.flowcheck.domain.LoadTestReport;
import com.flowcheck.domain.TestRequest;
import com.flowcheck.dto.LoadTest.LoadTestRequest;
import com.flowcheck.dto.LoadTest.LoadTestResponse;
import com.flowcheck.dto.LoadTest.LoadTestSubmittedEvent;
import com.flowcheck.repository.LoadTestReportRepository;
import com.flowcheck.repository.TestRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class AsyncLoadTestWorker {

    private final TestRequestRepository testRequestRepository;
    private final LoadTestReportRepository loadTestReportRepository;
    private final LoadTestStreamService loadTestStreamService;
    private final RestClient restClient;

    @Value("${fastapi.url}")
    private String fastApiUrl;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void executeTestAsync(LoadTestSubmittedEvent event) {
        UUID requestId = event.requestId();
        LoadTestRequest request = event.request();

        request.setRequestId(requestId);

        TestRequest testHistory = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));

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
            LoadTestResponse.TestResults testResults = restClient.post()
                    .uri(fastApiUrl + "/api/load-tests")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(), (req, res) -> {
                        throw new RuntimeException("FastAPI Error: " + res.getStatusCode());
                    })
                    .body(LoadTestResponse.TestResults.class);

            if (testResults == null) {
                throw new RuntimeException("FastAPI Error: testResults is null");
            }
            String aiReview = testResults.getBottleneckComment();
            if (aiReview == null || aiReview.isBlank()) {
                aiReview = "AI 분석 결과가 비어 있습니다.";
            }

            LoadTestReport report = LoadTestReport.builder()
                    .testRequest(testHistory)
                    .vusers(request.getVusers())
                    .totalTps(BigDecimal.valueOf(testResults.getMaxTps()))
                    .avgLatency((int) (testResults.getAvgResponse() * 1000))
                    .errorRate(BigDecimal.valueOf(testResults.getErrorRate()))
                    .rawMetrics(Map.of("points", testResults.getPoints()))
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
            log.error("Load test failed for request {}", requestId, e);
            testHistory.changeStatus("FAILED");
            testHistory.changePhase("FAILED");
            testHistory.changeProgress(100);
            testRequestRepository.save(testHistory);
            loadTestStreamService.updateProgress(requestId,
                    new com.flowcheck.dto.LoadTest.LoadTestProgressUpdateRequest(
                            "FAILED",
                            "FAILED",
                            100,
                            e.getMessage() != null ? e.getMessage() : "부하 테스트 처리 중 오류가 발생했습니다."));
        }
    }
}
