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
    private final RestClient restClient;

    @Value("${fastapi.url}")
    private String fastApiUrl;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void executeTestAsync(LoadTestSubmittedEvent event) {
        UUID requestId = event.requestId();
        LoadTestRequest request = event.request();

        TestRequest testHistory = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));

        try {
            testHistory.changeStatus("RUNNING");
            testHistory.changePhase("PREPARING_REQUEST");
            testHistory.changeProgress(10);
            testRequestRepository.save(testHistory);

            testHistory.changePhase("CALLING_FASTAPI");
            testHistory.changeProgress(20);
            testRequestRepository.save(testHistory);

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

            testHistory.changePhase("PROCESSING_RESULTS");
            testHistory.changeProgress(80);
            testRequestRepository.save(testHistory);

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
            testHistory.changeProgress(90);
            testRequestRepository.save(testHistory);

            loadTestReportRepository.save(report);

            testHistory.changeStatus("COMPLETED");
            testHistory.changePhase("COMPLETED");
            testHistory.changeProgress(100);
            testRequestRepository.save(testHistory);

        } catch (Exception e) {
            log.error("Load test failed for request {}", requestId, e);
            testHistory.changeStatus("FAILED");
            testHistory.changePhase("FAILED");
            testHistory.changeProgress(100);
            testRequestRepository.save(testHistory);
        }
    }
}
