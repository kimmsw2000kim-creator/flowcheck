package com.flowcheck.controller;

import com.flowcheck.dto.LoadTest.LoadTestRequest;
import com.flowcheck.dto.LoadTest.LoadTestResponse;
import com.flowcheck.dto.LoadTest.LoadTestSubmitResponse;
import com.flowcheck.service.LoadTestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "Load Test", description = "부하 테스트 실행 및 조회 API")
@RestController
@RequestMapping("/api/load-tests")
@RequiredArgsConstructor
@Slf4j
public class LoadTestController {

    private final LoadTestService loadTestService;

    @Operation(summary = "부하 테스트 실행 요청", description = "새로운 부하 테스트를 큐에 등록하고 요청 ID를 반환받습니다.")
    @PostMapping()
    public ResponseEntity<?> runTest(
            @RequestHeader(value = "X-User-Id", defaultValue = "00000000-0000-0000-0000-000000000000") UUID userId,
            @Valid @RequestBody LoadTestRequest request) {

        try {
            UUID requestId = loadTestService.submitLoadTest(userId, request);

            return ResponseEntity.status(HttpStatus.ACCEPTED).body(
                    LoadTestSubmitResponse.builder()
                            .requestId(requestId)
                            .status("PENDING")
                            .message("Load test has been queued successfully.")
                            .build()
            );

        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (IllegalStateException e) {
            // 잔액 부족
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(e.getMessage());
        }
    }

    @Operation(summary = "부하 테스트 결과 조회", description = "특정 요청 ID에 대한 부하 테스트 결과를 가져옵니다.")
    @GetMapping("/{requestId}")
    public ResponseEntity<LoadTestResponse> getTestResult(@PathVariable UUID requestId) {
        LoadTestResponse response = loadTestService.getTestResult(requestId);
        return ResponseEntity.ok(response);
    }

}
