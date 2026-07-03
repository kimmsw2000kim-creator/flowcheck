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

            LoadTestReport report = LoadTestReport.builder()
                    .testRequest(testHistory)
                    .vusers(request.getVusers())
                    .totalTps(BigDecimal.valueOf(testResults.getMaxTps()))
                    .avgLatency((int) (testResults.getAvgResponse() * 1000))
                    .errorRate(BigDecimal.valueOf(testResults.getErrorRate()))
                    .rawMetrics(Map.of("points", testResults.getPoints()))
                    .aiPerformanceReview(testResults.getBottleneckDiagnosis())
                    .build();

            loadTestReportRepository.save(report);

            testHistory.changeStatus("COMPLETED");
            testRequestRepository.save(testHistory);

        } catch (Exception e) {
            log.error("Load test failed for request {}", requestId, e);
            testHistory.changeStatus("FAILED");
            testRequestRepository.save(testHistory);
        }
    }
}
