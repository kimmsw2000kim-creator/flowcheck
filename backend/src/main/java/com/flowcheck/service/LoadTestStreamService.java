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
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class LoadTestStreamService {

    private final TestRequestRepository testRequestRepository;
    private final Map<UUID, Set<SseEmitter>> emitters = new ConcurrentHashMap<>();

    @Transactional(readOnly = true)
    public synchronized SseEmitter register(UUID userId, UUID requestId) {
        TestRequest testRequest = testRequestRepository
                .findByIdAndUser_UserIdAndTestType(requestId, userId, "LOAD")
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Load test not found"));

        SseEmitter emitter = new SseEmitter(0L);

        if (isTerminal(testRequest.getTestStatus())) {
            safeSend(emitter, buildSnapshot(testRequest, null));
            emitter.complete();
            return emitter;
        }

        emitters.computeIfAbsent(requestId, ignored -> ConcurrentHashMap.newKeySet())
                .add(emitter);

        emitter.onCompletion(() -> removeEmitter(requestId, emitter));
        emitter.onTimeout(() -> {
            removeEmitter(requestId, emitter);
            emitter.complete();
        });
        emitter.onError(error -> removeEmitter(requestId, emitter));

        if (!safeSend(emitter, buildSnapshot(testRequest, null))) {
            removeEmitter(requestId, emitter);
        }
        return emitter;
    }

    synchronized void removeEmitter(UUID requestId, SseEmitter emitter) {
        Set<SseEmitter> requestEmitters = emitters.get(requestId);
        if (requestEmitters == null) {
            return;
        }

        requestEmitters.remove(emitter);
        if (requestEmitters.isEmpty()) {
            emitters.remove(requestId, requestEmitters);
        }
    }

    synchronized int emitterCount(UUID requestId) {
        Set<SseEmitter> requestEmitters = emitters.get(requestId);
        return requestEmitters == null ? 0 : requestEmitters.size();
    }

    @Transactional
    public void updateProgress(UUID requestId, LoadTestProgressUpdateRequest request) {
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Invalid request ID"));

        if (isTerminal(testRequest.getTestStatus())
                && !testRequest.getTestStatus().equals(request.status())) {
            log.warn(
                    "Ignored load test progress after terminal state: requestId={}, currentStatus={}, incomingStatus={}, incomingPhase={}",
                    requestId,
                    testRequest.getTestStatus(),
                    request.status(),
                    request.phase());
            return;
        }

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

    private boolean isTerminal(String status) {
        return "COMPLETED".equals(status) || "FAILED".equals(status);
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

    private synchronized void broadcast(UUID requestId, LoadTestResponse payload) {
        Set<SseEmitter> requestEmitters = emitters.get(requestId);
        if (requestEmitters == null || requestEmitters.isEmpty()) {
            return;
        }

        for (SseEmitter emitter : new HashSet<>(requestEmitters)) {
            if (!safeSend(emitter, payload)) {
                requestEmitters.remove(emitter);
            }
        }

        if (isTerminal(payload.getStatus())) {
            emitters.remove(requestId, requestEmitters);
            for (SseEmitter emitter : new HashSet<>(requestEmitters)) {
                emitter.complete();
            }
            requestEmitters.clear();
        } else if (requestEmitters.isEmpty()) {
            emitters.remove(requestId, requestEmitters);
        }
    }

    private boolean safeSend(SseEmitter emitter, LoadTestResponse payload) {
        try {
            emitter.send(payload);
            return true;
        } catch (IOException | IllegalStateException e) {
            emitter.completeWithError(e);
            return false;
        }
    }
}
