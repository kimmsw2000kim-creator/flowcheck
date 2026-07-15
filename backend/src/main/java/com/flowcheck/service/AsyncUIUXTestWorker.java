package com.flowcheck.service;

import com.flowcheck.domain.TestRequest;
import com.flowcheck.dto.uiuxtest.UIUXTestStartRequest;
import com.flowcheck.dto.uiuxtest.UIUXTestSubmittedEvent;
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

import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class AsyncUIUXTestWorker {

    private final TestRequestRepository testRequestRepository;
    private final RestClient restClient;

    @Value("${fastapi.url}")
    private String fastApiUrl;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void executeTestAsync(UIUXTestSubmittedEvent event) {
        UUID requestId = event.requestId();
        UIUXTestStartRequest request = event.request();

        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("UIUX request not found"));

        try {
            testRequest.changeStatus("RUNNING");
            testRequest.changePhase("DISPATCHED_TO_FASTAPI");
            testRequest.changeProgress(10);
            testRequestRepository.save(testRequest);

            Map<String, String> payload = Map.of(
                    "requestId", requestId.toString(),
                    "targetUrl", request.getTargetUrl(),
                    "promptInput", request.getPromptInput() != null ? request.getPromptInput() : "");

            log.info("Dispatching UIUX request {} to FastAPI", requestId);
            restClient.post()
                    .uri(fastApiUrl + "/api/uiux-tests")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.info("UIUX request {} accepted by FastAPI", requestId);
        } catch (Exception e) {
            log.error("UIUX test dispatch failed for request {}", requestId, e);
            testRequest.changeStatus("FAILED");
            testRequest.changePhase("FAILED");
            testRequest.changeProgress(100);
            testRequestRepository.save(testRequest);
        }
    }
}
