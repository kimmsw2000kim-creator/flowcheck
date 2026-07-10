package com.flowcheck.controller;

import com.flowcheck.dto.uiuxtest.*;
import com.flowcheck.service.UiUxTestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;
import java.util.Base64;
import java.nio.charset.StandardCharsets;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.server.ResponseStatusException;

@Tag(name = "UI Test Explorer", description = "자율형 UI 탐색 API")
@RestController
@RequestMapping("/api/ui-tests")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:5173", "https://flow-check.duckdns.org"})
public class UiTestController {

    private final UiUxTestService uiTestService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Operation(summary = "UI 탐색 테스트 시작", description = "자율형 AI 크롤링 및 UX 분석 테스트를 생성하고 시작 요청을 보냅니다.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "202", description = "테스트 시작 성공 (PENDING)"),
            @ApiResponse(responseCode = "400", description = "잘못된 요청 또는 활성화된 테스트 중복"),
            @ApiResponse(responseCode = "401", description = "인증 실패 (유효하지 않은 토큰)"),
            @ApiResponse(responseCode = "402", description = "크레딧 또는 쿠폰 잔액 부족"),
            @ApiResponse(responseCode = "500", description = "서버 내부 오류 또는 AI 서버 연동 실패")
    })
    @PostMapping
    public ResponseEntity<?> startUiTest(
            @Parameter(description = "테스트를 실행할 사용자 이메일 (임시 인증 우회용)", required = false) @RequestParam(defaultValue = "test@example.com") String email,
            @Parameter(description = "UI/UX 테스트 시작에 필요한 대상 URL 및 프롬프트 정보", required = true) @Valid @RequestBody UiUxTestStartRequest request) {
        try {
            // [임시] JWT 기능이 완성될 때까지 파라미터로 받은 이메일을 그대로 사용합니다.
            UUID requestId = uiTestService.submitUiTest(email, request);
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(
                    UiUxTestStartResponse.builder()
                            .requestId(requestId)
                            .status("PENDING")
                            .message("UI Autonomous Test exploration has been initiated.")
                            .build()
            );
        } catch (IllegalArgumentException e) {
            log.error("Bad Request on UI test submission", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (IllegalStateException e) {
            log.warn("Payment required on UI test submission", e);
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(e.getMessage());
        } catch (Exception e) {
            log.error("Internal Server Error on UI test submission", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @Operation(summary = "UI 탐색 실시간 상태 및 결과 조회", description = "특정 요청 ID에 대응하는 통합 리포트 및 내장 jsonb 스텝 로그 데이터를 조회합니다.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "테스트 상태 조회 성공"),
            @ApiResponse(responseCode = "404", description = "해당 UUID의 테스트 요청을 찾을 수 없음"),
            @ApiResponse(responseCode = "500", description = "서버 내부 오류")
    })
    @GetMapping("/{requestId}/status")
    public ResponseEntity<?> getTestStatus(
            @Parameter(description = "조회할 테스트의 식별자(UUID)", required = true) @PathVariable UUID requestId) {
        try {
            UiUxTestStatusResponse response = uiTestService.getTestStatus(requestId);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.error("Test status not found: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (Exception e) {
            log.error("Error retrieving test status", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @Operation(summary = "AI 서버 최종 리포트 및 스텝 데이터 일괄 접수", description = "AI 에이전트가 탐색 종료 후 마크다운 보고서와 수집된 스텝 로그 배열을 일괄 제출합니다.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "리포트 및 스텝 데이터 저장 성공"),
            @ApiResponse(responseCode = "400", description = "잘못된 요청 (예: 존재하지 않는 테스트 ID)"),
            @ApiResponse(responseCode = "500", description = "서버 내부 오류")
    })
    @PostMapping("/{requestId}/report")
    public ResponseEntity<?> submitReport(
            @Parameter(description = "리포트를 제출할 테스트의 식별자(UUID)", required = true) @PathVariable UUID requestId,
            @Parameter(description = "제출할 최종 마크다운 리포트 정보", required = true) @RequestBody UiUxTestReportSubmitRequest request) {
        try {
            uiTestService.saveReport(requestId, request);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            log.warn("Invalid report submission: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (Exception e) {
            log.error("Error submitting report", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @Operation(summary = "AI 서버 실행 실패 보고 접수", description = "AI 에이전트 탐색 중 치명적 결함이나 비정상 중단 상황에 대한 실패 사유를 접수합니다.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "실패 사유 접수 및 테스트 상태 FAILED 변경 성공"),
            @ApiResponse(responseCode = "400", description = "잘못된 요청 (예: 존재하지 않는 테스트 ID)"),
            @ApiResponse(responseCode = "500", description = "서버 내부 오류")
    })
    @PostMapping("/{requestId}/fail")
    public ResponseEntity<?> reportFailure(
            @Parameter(description = "실패를 보고할 테스트의 식별자(UUID)", required = true) @PathVariable UUID requestId,
            @Parameter(description = "발생한 치명적 오류 또는 실패 사유", required = true) @RequestParam String reason) {
        try {
            uiTestService.markAsFailed(requestId, reason);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            log.warn("Invalid failure report: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (Exception e) {
            log.error("Error reporting failure", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    // [임시 주석 처리] JWT 토큰 기능이 없으므로 비활성화합니다.
    /*
    private String extractEmailFromToken(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing or invalid Authorization header");
        }
        String token = authorization.substring(7);
        try {
            String[] parts = token.split("\\.");
            if (parts.length < 2) {
                throw new IllegalArgumentException("Invalid JWT format");
            }
            String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            JsonNode payloadNode = objectMapper.readTree(payloadJson);
            return payloadNode.get("email").asText();
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Failed to parse token");
        }
    }
    */
}