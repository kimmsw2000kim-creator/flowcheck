package com.flowcheck.controller;

import com.flowcheck.dto.LoadTest.LoadTestProgressUpdateRequest;
import com.flowcheck.dto.LoadTest.LoadTestRequest;
import com.flowcheck.dto.LoadTest.LoadTestResponse;
import com.flowcheck.dto.LoadTest.LoadTestSubmitResponse;
import com.flowcheck.service.LoadTestService;
import com.flowcheck.service.LoadTestStreamService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

@Tag(name = "Load Test", description = "부하 테스트 실행 및 조회 API")
@RestController
@RequestMapping("/api/load-tests")
@RequiredArgsConstructor
@Slf4j
public class LoadTestController {

    private final LoadTestService loadTestService;
    private final LoadTestStreamService loadTestStreamService;

    @Operation(summary = "부하 테스트 실행 요청", description = "새로운 부하 테스트를 큐에 등록하고 요청 ID를 반환받습니다.")
    @PostMapping()
    public ResponseEntity<?> runTest(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody LoadTestRequest request) {

        try {
            UUID userId = UUID.fromString(jwt.getSubject());

            UUID requestId = loadTestService.submitLoadTest(userId, request);

            return ResponseEntity.status(HttpStatus.ACCEPTED).body(
                    LoadTestSubmitResponse.builder()
                            .requestId(requestId)
                            .status("PENDING")
                            .message("Load test has been queued successfully.")
                            .build());

        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (IllegalStateException e) {
            // 잔액 부족
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(e.getMessage());
        }
    }

    @Operation(summary = "부하 테스트 결과 조회", description = "특정 요청 ID에 대한 부하 테스트 결과를 가져옵니다.")
    @GetMapping("/{requestId}")
    public ResponseEntity<LoadTestResponse> getTestResult(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID requestId) {
        UUID userId = UUID.fromString(jwt.getSubject());
        LoadTestResponse response = loadTestService.getTestResult(userId, requestId);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "부하 테스트 실시간 상태 스트림", description = "특정 요청 ID의 진행 상태를 SSE로 스트리밍합니다.")
    @GetMapping(value = "/{requestId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> streamTestStatus(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID requestId) {
        UUID userId = UUID.fromString(jwt.getSubject());
        SseEmitter emitter = loadTestStreamService.register(userId, requestId);
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Accel-Buffering", "no");
        return new ResponseEntity<>(emitter, headers, HttpStatus.OK);
    }

    @Operation(summary = "부하 테스트 진행 상태 접수", description = "FastAPI 서버가 요청 ID별 진행 상태를 Spring에 전달합니다.")
    @PostMapping("/{requestId}/progress")
    public ResponseEntity<Void> updateTestProgress(
            @PathVariable UUID requestId,
            @Valid @RequestBody LoadTestProgressUpdateRequest request) {
        loadTestStreamService.updateProgress(requestId, request);
        return ResponseEntity.ok().build();
    }

}
