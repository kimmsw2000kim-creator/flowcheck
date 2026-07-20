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

    // UI/UX 테스트 요청을 FastAPI 실행 서버로 넘기는 비동기 워커입니다.
    // UIUXTestService가 DB에 TestRequest를 저장하고 이벤트를 발행하면, 트랜잭션 커밋 이후 이 클래스가 받아
    // Spring 요청 스레드와 분리된 상태에서 Python 오케스트레이터를 호출합니다.
    private final TestRequestRepository testRequestRepository;
    private final RestClient restClient;

    @Value("${fastapi.url}")
    private String fastApiUrl;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void executeTestAsync(UIUXTestSubmittedEvent event) {
        // AFTER_COMMIT을 쓰는 이유:
        // FastAPI/Python 워커가 requestId로 Spring 백엔드에 step/report 콜백을 보내기 때문에,
        // DB 커밋 전 외부 호출을 하면 워커가 아직 존재하지 않는 requestId를 조회할 수 있습니다.
        UUID requestId = event.requestId();
        UIUXTestStartRequest request = event.request();

        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("UIUX request not found"));

        try {
            // FastAPI 전달이 시작됐음을 상태로 남겨 프론트 polling에서 "실행 중"으로 볼 수 있게 합니다.
            testRequest.changeStatus("RUNNING");
            testRequest.changePhase("DISPATCHED_TO_FASTAPI");
            testRequest.changeProgress(10);
            testRequestRepository.save(testRequest);

            Map<String, String> payload = Map.of(
                    // FastAPI는 requestId/targetUrl만 있으면 별도 background task에서 Docker/Fargate 워커를 띄울 수 있습니다.
                    // promptInput은 현재 UIUX 워커에서 적극 사용하지 않지만 확장용으로 전달 구조를 유지합니다.
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
            // FastAPI에 전달조차 못 한 경우에는 Python 쪽 fail 콜백이 올 수 없으므로 Spring에서 직접 FAILED 처리합니다.
            log.error("UIUX test dispatch failed for request {}", requestId, e);
            testRequest.changeStatus("FAILED");
            testRequest.changePhase("FAILED");
            testRequest.changeProgress(100);
            testRequestRepository.save(testRequest);
        }
    }
}
