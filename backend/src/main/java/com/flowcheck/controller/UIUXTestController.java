package com.flowcheck.controller;


import com.flowcheck.dto.uiuxtest.*;
import com.flowcheck.service.UIUXTestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "UI Test Explorer", description = "자율형 UI 탐색 API")
@RestController
@RequestMapping("/api/uiux-tests")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = { "http://localhost:5173", "https://flow-check.duckdns.org" })
public class UIUXTestController {

    private final UIUXTestService UIUXTestService;


    @Operation(summary = "UI 탐색 테스트 시작", description = "자율형 AI 크롤링 및 UX 분석 테스트를 생성하고 시작 요청을 보냅니다.")
    @PostMapping
    public ResponseEntity<?> startUIUXTest(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UIUXTestStartRequest request) {
        try {
            UUID userId = UUID.fromString(jwt.getSubject());
            UUID requestId = UIUXTestService.submitUIUXTest(userId, request);
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(
                    UIUXTestStartResponse.builder()
                            .requestId(requestId)
                            .status("PENDING")
                            .message("UI 자율 탐색 테스트가 시작되었습니다.")
                            .build());
        } catch (IllegalArgumentException e) {
            log.error("UI 테스트 제출 중 잘못된 요청 발생", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (IllegalStateException e) {
            log.warn("UI 테스트 제출 시 결제(크레딧/쿠폰) 필요", e);
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(e.getMessage());
        } catch (Exception e) {
            log.error("UI 테스트 제출 중 내부 서버 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @Operation(summary = "UI 탐색 실시간 상태 및 결과 조회", description = "특정 요청 ID에 대응하는 실시간 탐색 단계(Telemetry) 및 종합 보고서를 조회합니다.")
    @GetMapping("/{requestId}/status")
    public ResponseEntity<?> getTestStatus(@PathVariable UUID requestId) {
        try {
            // 핵심 로직: 해당 요청 ID의 최신 진행 상태와 스텝 정보를 서비스 계층에서 조회하여 반환
            UIUXTestStatusResponse response = UIUXTestService.getTestStatus(requestId);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            // 핵심 로직: 유효하지 않은 UUID 요청이거나 데이터가 없는 경우 404 (Not Found) 에러 반환
            log.error("테스트 상태를 찾을 수 없음: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (Exception e) {
            log.error("테스트 상태 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @Operation(summary = "AI 서버 실시간 스텝 기록 접수", description = "AI 에이전트(FastAPI)가 탐색 단계별 수행 결과를 보고합니다.")
    @PostMapping("/{requestId}/steps")
    public ResponseEntity<?> addStep(
            @PathVariable UUID requestId,
            @RequestBody java.util.Map<String, Object> request) {
        try {
            // 핵심 로직: AI 서버에서 전달받은 스텝 로그를 저장
            UIUXTestService.addStep(requestId, request);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            log.warn("유효하지 않은 스텝 로그 제출: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (Exception e) {
            log.error("스텝 로그 제출 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @Operation(summary = "AI 서버 최종 마크다운 리포트 접수", description = "AI 에이전트(FastAPI)가 탐색 종료 후 최종 종합 보고서 텍스트를 제출합니다.")
    @PostMapping("/{requestId}/report")
    public ResponseEntity<?> submitReport(
            @PathVariable UUID requestId,
            @RequestBody UIUXTestReportSubmitRequest request) {
        try {
            // 핵심 로직: 전체 테스트 결과(리포트) 저장 및 상태를 COMPLETED로 변경하여 테스트 종료 처리
            UIUXTestService.saveReport(requestId, request);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            log.warn("유효하지 않은 리포트 제출: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (Exception e) {
            log.error("리포트 제출 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @Operation(summary = "AI 서버 실행 실패 보고 접수", description = "AI 에이전트(FastAPI) 탐색 중 에러나 비정상 중단 상황을 보고합니다.")
    @PostMapping("/{requestId}/fail")
    public ResponseEntity<?> reportFailure(
            @PathVariable UUID requestId,
            @RequestParam String reason) {
        try {
            // 핵심 로직: 테스트 실패 상태 기록 및 원인 저장
            UIUXTestService.markAsFailed(requestId, reason);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            log.warn("유효하지 않은 실패 보고: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (Exception e) {
            log.error("실패 보고 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }
}
