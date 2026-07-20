package com.flowcheck.controller;


import com.flowcheck.dto.uiuxtest.*;
import com.flowcheck.service.UIUXTestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.UUID;

@Tag(name = "UI Test Explorer", description = "자율형 UI 탐색 API")
@RestController
@RequestMapping("/api/uiux-tests")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = { "http://localhost:5173", "https://flow-check.duckdns.org" })
public class UIUXTestController {

    private static final String CALLBACK_TOKEN_HEADER = "X-Internal-Api-Key";

    // UI/UX 테스트의 HTTP 진입점입니다.
    // 사용자가 직접 호출하는 시작/상태/VNC/취소 API와, Python 워커가 콜백하는 steps/report/fail API가
    // 같은 requestId를 중심으로 모입니다.
    private final UIUXTestService UIUXTestService;

    @Value("${internal.uiux-test-callback-token}")
    private String uiuxTestCallbackToken;


    @Operation(summary = "UI 탐색 테스트 시작", description = "자율형 AI 크롤링 및 UX 분석 테스트를 생성하고 시작 요청을 보냅니다.")
    @PostMapping
    public ResponseEntity<?> startUIUXTest(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UIUXTestStartRequest request) {
        try {
            // 테스트 시작은 동기적으로 결과를 기다리지 않습니다.
            // 서비스에서 결제/중복 실행/요청 저장을 끝낸 뒤 requestId만 반환하고,
            // 실제 브라우저 실행은 트랜잭션 커밋 이후 AsyncUIUXTestWorker가 FastAPI로 넘깁니다.
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
            if (e.getMessage().contains("진행 중인")) {
                log.warn("UI 테스트 제출 중복 요청", e);
                return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
            }
            log.warn("UI 테스트 제출 시 결제(크레딧/쿠폰) 필요", e);
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(e.getMessage());
        } catch (Exception e) {
            log.error("UI 테스트 제출 중 내부 서버 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @Operation(summary = "UI 탐색 실시간 상태 및 결과 조회", description = "특정 요청 ID에 대응하는 실시간 탐색 단계(Telemetry) 및 종합 보고서를 조회합니다.")
    @GetMapping("/{requestId}/status")
    public ResponseEntity<?> getTestStatus(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID requestId) {
        try {
            // 상태 조회도 테스트 소유자만 볼 수 있어야 합니다.
            // requestId만으로 조회하면 다른 사용자의 결과/영상/VNC 상태가 노출될 수 있으므로 userId를 함께 검증합니다.
            UUID userId = UUID.fromString(jwt.getSubject());
            UIUXTestStatusResponse response = UIUXTestService.getTestStatusForUser(userId, requestId);
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

    @Operation(summary = "UI 탐색 VNC signed URL 발급", description = "로그인 사용자의 UI/UX 테스트 실시간 VNC 접근 URL을 발급합니다.")
    @PostMapping("/{requestId}/vnc-token")
    public ResponseEntity<?> issueVncToken(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID requestId) {
        String userIdForLog = jwt != null ? jwt.getSubject() : "anonymous";
        log.info("VNC_DIAG token_request requestId={} userId={}", requestId, userIdForLog);
        try {
            // VNC는 테스트 대상 브라우저 화면을 그대로 보여주므로 임의 접근을 막아야 합니다.
            // 사용자가 해당 테스트 소유자인지 확인하고, noVNC 서버가 실제로 준비된 경우에만
            // 짧은 만료 시간을 가진 signed URL을 발급합니다.
            UUID userId = UUID.fromString(userIdForLog);
            long expiresAt = UIUXTestService.issueVncAccessExpiresAt(userId, requestId);
            String token = UIUXTestService.signVncAccess(requestId, expiresAt);
            String websocketPath = "/api/uiux-tests/" + requestId + "/vnc-ws"
                    + "?expires=" + expiresAt
                    + "&token=" + token;
            String url = "/api/uiux-tests/" + requestId + "/vnc/vnc.html"
                    + "?autoconnect=true"
                    + "&resize=scale"
                    + "&shared=true"
                    + "&path=" + URLEncoder.encode(websocketPath, StandardCharsets.UTF_8)
                    + "&expires=" + expiresAt
                    + "&token=" + token;

            log.info("VNC_DIAG token_ready requestId={} userId={} expiresAt={} proxyPath={}",
                    requestId, userIdForLog, expiresAt, "/api/uiux-tests/" + requestId + "/vnc/vnc.html");
            return ResponseEntity.ok(UIUXVncAccessResponse.ready(url, expiresAt));
        } catch (IllegalArgumentException e) {
            log.warn("VNC signed URL 발급 실패: {}", e.getMessage());
            log.warn("VNC_DIAG token_forbidden requestId={} userId={} reason={}", requestId, userIdForLog, e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        } catch (IllegalStateException e) {
            log.warn("VNC signed URL 준비 실패: {}", e.getMessage());
            log.info("VNC_DIAG token_pending requestId={} userId={} reason={}", requestId, userIdForLog, e.getMessage());
            return ResponseEntity.accepted().body(UIUXVncAccessResponse.pending(e.getMessage()));
        } catch (Exception e) {
            log.error("VNC_DIAG token_error requestId={} userId={}", requestId, userIdForLog, e);
            log.error("VNC signed URL 발급 중 오류", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @Operation(summary = "AI 서버 실시간 스텝 기록 접수", description = "AI 에이전트(FastAPI)가 탐색 단계별 수행 결과를 보고합니다.")
    @PostMapping("/{requestId}/steps")
    public ResponseEntity<?> addStep(
            @PathVariable UUID requestId,
            @RequestHeader(value = CALLBACK_TOKEN_HEADER, required = false) String callbackToken,
            @RequestBody java.util.Map<String, Object> request) {
        try {
            validateCallbackToken(requestId, callbackToken);
            // Python 워커/오케스트레이터가 보내는 진행 로그입니다.
            // 프론트는 /status polling으로 이 rawLogs를 받아 "실행 로그"와 VNC 준비 상태를 표시합니다.
            UIUXTestService.addStep(requestId, request);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            log.warn("유효하지 않은 스텝 로그 제출: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("스텝 로그 제출 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @Operation(summary = "AI 서버 최종 마크다운 리포트 접수", description = "AI 에이전트(FastAPI)가 탐색 종료 후 최종 종합 보고서 텍스트를 제출합니다.")
    @PostMapping("/{requestId}/report")
    public ResponseEntity<?> submitReport(
            @PathVariable UUID requestId,
            @RequestHeader(value = CALLBACK_TOKEN_HEADER, required = false) String callbackToken,
            @RequestBody UIUXTestReportSubmitRequest request) {
        try {
            validateCallbackToken(requestId, callbackToken);
            // 워커가 모든 탐색/검사/점수 계산을 마친 뒤 보내는 최종 결과입니다.
            // 이 요청이 성공하면 점수, 결함, 영상 URL, 마크다운 보고서가 저장되고 테스트가 COMPLETED로 종료됩니다.
            UIUXTestService.saveReport(requestId, request);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            log.warn("유효하지 않은 리포트 제출: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("리포트 제출 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @Operation(summary = "AI 서버 실행 실패 보고 접수", description = "AI 에이전트(FastAPI) 탐색 중 에러나 비정상 중단 상황을 보고합니다.")
    @PostMapping("/{requestId}/fail")
    public ResponseEntity<?> reportFailure(
            @PathVariable UUID requestId,
            @RequestHeader(value = CALLBACK_TOKEN_HEADER, required = false) String callbackToken,
            @RequestParam String reason) {
        try {
            validateCallbackToken(requestId, callbackToken);
            // 컨테이너 시작 실패, URL 로드 실패, Playwright 실행 예외처럼 테스트 전체가 더 진행될 수 없는 경우 호출됩니다.
            // Lighthouse/axe 단독 실패는 여기로 오지 않고 최종 리포트의 대체 규칙 경로로 처리됩니다.
            UIUXTestService.markAsFailed(requestId, reason);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            log.warn("유효하지 않은 실패 보고: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("실패 보고 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @Operation(summary = "UI/UX 테스트 사용자 중지", description = "로그인 사용자가 진행 중인 UI/UX 테스트를 중지하고 실패 상태로 표시합니다.")
    @PostMapping("/{requestId}/cancel")
    public ResponseEntity<?> cancelTest(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID requestId) {
        try {
            UUID userId = UUID.fromString(jwt.getSubject());
            UIUXTestService.cancelTestForUser(userId, requestId);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            log.warn("UI/UX 테스트 중지 요청 실패: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (IllegalStateException e) {
            log.warn("UI/UX 테스트 중지 불가: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
        } catch (Exception e) {
            log.error("UI/UX 테스트 중지 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @PostMapping("/{requestId}/client-log")
    public ResponseEntity<?> recordClientLog(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID requestId,
            @RequestBody java.util.Map<String, Object> payload) {
        // 브라우저 iframe 로드, VNC 토큰 재시도 같은 프론트 전용 진단 로그입니다.
        // DB에는 저장하지 않고 서버 로그에만 남겨 배포 환경의 VNC 연결 문제를 추적합니다.
        String userId = jwt != null ? jwt.getSubject() : "anonymous";
        String event = sanitizeClientLogValue(payload != null ? payload.get("event") : null);
        String detail = sanitizeClientLogValue(payload != null ? payload.get("detail") : null);
        log.info("VNC_DIAG client requestId={} userId={} event={} detail={}", requestId, userId, event, detail);
        return ResponseEntity.ok().build();
    }

    private String sanitizeClientLogValue(Object value) {
        // signed VNC URL에는 token query가 들어가므로 로그에 남기기 전에 마스킹합니다.
        // detail 전체가 길어지는 경우도 있어 로그 폭주 방지용으로 길이를 제한합니다.
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value)
                .replaceAll("(?i)(token=)[^&\\s,}]+", "$1[redacted]");
        return text.length() <= 2000 ? text : text.substring(0, 2000) + "...[truncated]";
    }

    private void validateCallbackToken(UUID requestId, String callbackToken) {
        if (uiuxTestCallbackToken == null || uiuxTestCallbackToken.isBlank()) {
            log.error("UIUX_TEST_CALLBACK_TOKEN is not configured");
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "UI/UX callback authentication is not configured");
        }

        boolean tokenMatches = callbackToken != null && MessageDigest.isEqual(
                uiuxTestCallbackToken.getBytes(StandardCharsets.UTF_8),
                callbackToken.getBytes(StandardCharsets.UTF_8));

        if (!tokenMatches) {
            log.warn("Rejected UI/UX callback for request {}", requestId);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid callback credentials");
        }
    }
}
