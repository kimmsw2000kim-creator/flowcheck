package com.flowcheck.controller;

import com.flowcheck.dto.TrafficTestRequestDTO;
import com.flowcheck.service.TrafficTestService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/test/traffic")
@RequiredArgsConstructor
public class TrafficTestController {

    // 인메모리 상태 저장 (추후 DB나 Redis로 변경 가능)
    private final Map<String, TrafficTestStatusDTO> testStore = new ConcurrentHashMap<>();

    // service
    private TrafficTestService trafficTestService;

    @PostMapping("/run")
    public TrafficTestResponseDTO runTest(@RequestBody TrafficTestRequestDTO request) {
        String testId = UUID.randomUUID().toString();
        
        testStore.put(testId, new TrafficTestStatusDTO("running", null, null));

        executeLoadTestAsync(testId, request.getVusers(), request.getDuration());

        return new TrafficTestResponseDTO(testId);
    }

    @GetMapping("/{testId}/status")
    public TrafficTestStatusDTO getTestStatus(@PathVariable String testId) {
        return testStore.getOrDefault(testId, new TrafficTestStatusDTO("NOT_FOUND", null, null));
    }

    @Async
    public void executeLoadTestAsync(String testId, int vusers, int duration) {
        try {
            // TODO: k6 처리
            // 테스트로 슬립
            Thread.sleep(duration * 1000L);

            TrafficTestMetrics metrics = new TrafficTestMetrics(vusers * 1.8, 120 + (vusers * 0.4), 0.0);

            testStore.put(testId, new TrafficTestStatusDTO("COMPLETED", metrics, "차트 데이터 생략"));

        } catch (InterruptedException e) {
            testStore.put(testId, new TrafficTestStatusDTO("FAILED", null, null));
        }
    }
}