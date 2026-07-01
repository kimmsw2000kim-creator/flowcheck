package com.flowcheck.controller;

import com.flowcheck.dto.LoadTest.LoadTestRequest;
import com.flowcheck.dto.LoadTest.LoadTestResponse;
import com.flowcheck.service.LoadTestService;
import jakarta.validation.Valid;
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
            @RequestHeader(value = "X-User-Id", defaultValue = "00000000-0000-0000-0000-000000000000") UUID userId,
            @Valid @RequestBody LoadTestRequest request) {

        LoadTestResponse response = loadTestService.runLoadTest(userId, request);
        return ResponseEntity.ok(response);

    }
}
