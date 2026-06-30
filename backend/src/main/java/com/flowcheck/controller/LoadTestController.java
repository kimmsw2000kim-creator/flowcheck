package com.flowcheck.controller;

import com.flowcheck.dto.LoadTest.LoadTestRequest;
import com.flowcheck.dto.LoadTest.LoadTestResponse;
import com.flowcheck.service.LoadTestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/test/loadtest")
@RequiredArgsConstructor
public class LoadTestController {

    private final LoadTestService loadTestService;

    @PostMapping("/run")
    public ResponseEntity<LoadTestResponse> runTest(
            // 실제 구현에서는 JWT 토큰 등에서 userId를 추출하는 커스텀 어노테이션(@AuthenticationPrincipal 등)을 사용합니다.
            // 여기서는 예시로 Header에서 받는다고 가정합니다.
            @RequestHeader("X-User-Id") UUID userId,
            @RequestBody LoadTestRequest request) {

        try {
            LoadTestResponse response = loadTestService.runLoadTest(userId, request);
            return ResponseEntity.ok(response);

        } catch (IllegalStateException e) {
            // 잔액/쿠폰 부족 예외 처리 (400 Bad Request 반환)
            // 프론트엔드의 axios.catch 로직에 잡히게 됩니다.
            return ResponseEntity.badRequest().body(null);
        }
    }
}
