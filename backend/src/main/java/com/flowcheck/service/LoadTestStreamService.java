package com.flowcheck.service;

import com.flowcheck.domain.TestRequest;
import com.flowcheck.dto.LoadTest.LoadTestProgressUpdateRequest;
import com.flowcheck.dto.LoadTest.LoadTestResponse;
import com.flowcheck.repository.TestRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class LoadTestStreamService {

    private final TestRequestRepository testRequestRepository;
    private final Map<UUID, SseEmitter> emitters = new ConcurrentHashMap<>();

    @Transactional(readOnly = true)
    public SseEmitter register(UUID userId, UUID requestId) {
        TestRequest testRequest = testRequestRepository
                .findByIdAndUser_UserIdAndTestType(requestId, userId, "LOAD")
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Load test not found"));

        SseEmitter emitter = new SseEmitter(0L);
        SseEmitter previous = emitters.put(requestId, emitter);
        if (previous != null) {
            previous.complete();
        }

        emitter.onCompletion(() -> emitters.remove(requestId, emitter));
        emitter.onTimeout(() -> {
            emitters.remove(requestId, emitter);
            emitter.complete();
        });
        emitter.onError(error -> emitters.remove(requestId, emitter));

        safeSend(emitter, buildSnapshot(testRequest, null));
        return emitter;
    }

    @Transactional
    public void updateProgress(UUID requestId, LoadTestProgressUpdateRequest request) {
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Invalid request ID"));

        testRequest.changeStatus(request.status());
        testRequest.changePhase(request.phase());
        testRequest.changeProgress(request.progress());
        testRequestRepository.save(testRequest);

        broadcast(requestId, buildSnapshot(testRequest, request.message()));
        log.info(
                "Load test progress updated: requestId={}, status={}, phase={}, progress={}",
                requestId,
                request.status(),
                request.phase(),
                request.progress());
    }

    private LoadTestResponse buildSnapshot(TestRequest testRequest, String message) {
        return LoadTestResponse.builder()
                .status(testRequest.getTestStatus())
                .phase(testRequest.getTestPhase())
                .progress(testRequest.getTestProgress())
                .message(message != null ? message
                        : buildMessage(testRequest.getTestStatus(), testRequest.getTestPhase()))
                .build();
    }

    private String buildMessage(String status, String phase) {
        if ("FAILED".equals(status)) {
            return "부하 테스트가 실패했습니다.";
        }

        return switch (phase) {
            case "GENERATING_SCRIPT" -> "k6 스크립트를 생성하는 중입니다.";
            case "PROVISIONING_INFRA" -> "클라우드 부하 테스트 인프라를 프로비저닝하고 실행 중입니다. (약 1분 소요)";
            case "PROCESSING_RESULTS" -> "실행 결과를 해석하는 중입니다.";
            case "RESULT_READY" -> "결과가 준비되었습니다.";
            case "DISPATCHED_TO_FASTAPI" -> "FastAPI에 부하 테스트 실행을 전달하는 중입니다.";
            case "SAVING_REPORT" -> "결과 리포트를 저장하는 중입니다.";
            case "COMPLETED" -> "부하 테스트가 완료되었습니다.";
            default -> "부하 테스트가 대기 중입니다.";
        };
    }

    private void broadcast(UUID requestId, LoadTestResponse payload) {
        SseEmitter emitter = emitters.get(requestId);
        if (emitter == null) {
            return;
        }

        safeSend(emitter, payload);

        if ("COMPLETED".equals(payload.getStatus()) || "FAILED".equals(payload.getStatus())) {
            emitter.complete();
            emitters.remove(requestId, emitter);
        }
    }

    private void safeSend(SseEmitter emitter, LoadTestResponse payload) {
        try {
            emitter.send(payload);
        } catch (IOException e) {
            emitter.completeWithError(e);
        }
    }
}
