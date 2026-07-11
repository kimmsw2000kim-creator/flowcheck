package com.flowcheck.service;

import com.flowcheck.domain.*;
import com.flowcheck.dto.uiuxtest.*;
import com.flowcheck.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UIUXTestService {

    private final UserRepository userRepository;
    private final UserCouponRepository userCouponRepository;
    private final CreditsLedgerRepository creditsLedgerRepository;
    private final TestRequestRepository testRequestRepository;
    private final UIUXTestReportRepository UIUXTestReportRepository;
    private final RestClient restClient;
    private final CouponUsageLogRepository couponUsageLogRepository;
    private final ObjectMapper objectMapper;

    @Value("${fastapi.url}")
    private String fastApiUrl;

    @Value("${supabase.url:}")
    private String supabaseUrl;

    @Value("${supabase.anon-key:}")
    private String supabaseAnonKey;

    private static final int TEST_COST = 1_000;
    private static final String TEST_TYPE_UIUX = "UIUX";
    private static final List<String> ACTIVE_TEST_STATUSES = List.of("PENDING", "RUNNING");
    private static final Duration STALE_ACTIVE_TEST_TIMEOUT = Duration.ofMinutes(15);

    private void failStaleActiveUIUXTests() {
        OffsetDateTime staleCutoff = OffsetDateTime.now().minus(STALE_ACTIVE_TEST_TIMEOUT);
        List<TestRequest> staleRequests = testRequestRepository
                .findByTestTypeAndTestStatusInAndCreatedAtBefore(
                        TEST_TYPE_UIUX,
                        ACTIVE_TEST_STATUSES,
                        staleCutoff);

        if (staleRequests.isEmpty()) {
            return;
        }

        staleRequests.forEach(testRequest -> {
            testRequest.changeStatus("FAILED");
            testRequest.changePhase("TIMEOUT");
            testRequest.changeProgress(100);
        });

        testRequestRepository.saveAll(staleRequests);
        log.warn("{}개의 오래된 UI/UX 테스트 요청을 {}분 경과로 인해 FAILED 처리했습니다.",
                staleRequests.size(),
                STALE_ACTIVE_TEST_TIMEOUT.toMinutes());
    }

    @Transactional
    public UUID submitUIUXTest(UUID userId, UIUXTestStartRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));

        failStaleActiveUIUXTests();

        boolean hasActiveTest = testRequestRepository.existsByUserAndTestTypeAndTestStatusIn(
                user, TEST_TYPE_UIUX, ACTIVE_TEST_STATUSES);
        if (hasActiveTest) {
            throw new IllegalStateException("이미 진행 중인 UI 테스트가 있습니다. 완료 후 다시 시도해 주세요.");
        }

        List<TestRequest> userUiRequests = testRequestRepository.findByUserAndTestTypeOrderByCreatedAtAsc(user, TEST_TYPE_UIUX);
        if (userUiRequests.size() >= 10) {
            int deleteCount = userUiRequests.size() - 9;
            for (int i = 0; i < deleteCount; i++) {
                TestRequest oldestRequest = userUiRequests.get(i);

                deleteVideoFromSupabase(oldestRequest.getId());

                testRequestRepository.delete(oldestRequest);
                log.info("10개 테스트 제한으로 인해 사용자 {}의 가장 오래된 UI 테스트 요청 기록 {}을 삭제했습니다.", userId, oldestRequest.getId());
            }
        }

        List<UserCoupon> availableCoupons = userCouponRepository
                .findByUserAndCoupon_CouponTypeAndRemainingChancesGreaterThanOrderByCreatedAtAsc(user, CouponType.UIUX_TEST, 0);

        if (!availableCoupons.isEmpty()) {
            UserCoupon couponToUse = availableCoupons.getFirst();
            couponToUse.useChance();

            couponUsageLogRepository.save(CouponUsageLog.builder()
                    .user(user)
                    .couponType(CouponType.UIUX_TEST)
                    .description("UI/UX 테스트 실행 (" + request.getTargetUrl() + ")")
                    .build());
        } else if (user.getBalance() >= TEST_COST) {
            user.deductBalance(TEST_COST);
            userRepository.save(user);

            CreditsLedger ledger = CreditsLedger.builder()
                    .user(user)
                    .amount(-TEST_COST)
                    .transactionType("TEST_CONSUME")
                    .description("AI UI/UX Test Execution")
                    .build();
            creditsLedgerRepository.save(ledger);
        } else {
            throw new IllegalStateException("UI/UX 테스트 쿠폰 또는 크레딧 잔액이 부족합니다.");
        }

        TestRequest testRequest = TestRequest.builder()
                .user(user)
                .targetUrl(request.getTargetUrl())
                .promptInput(request.getPromptInput() != null ? request.getPromptInput() : "")
                .testType(TEST_TYPE_UIUX)
                .testStatus("PENDING")
                .testPhase("QUEUED")
                .testProgress(0)
                .build();
        TestRequest savedRequest = testRequestRepository.save(testRequest);
        UUID requestId = savedRequest.getId();

        try {
            Map<String, String> payload = Map.of(
                    "requestId", requestId.toString(),
                    "targetUrl", request.getTargetUrl(),
                    "promptInput", request.getPromptInput() != null ? request.getPromptInput() : "");
            // 핵심 로직: FastAPI 서버로 UI 테스트 실행 비동기 요청 전송
            log.info("요청 ID {}에 대해 FastAPI 엔드포인트 /api/ui-tests 호출 중...", requestId);
            restClient.post()
                    .uri(fastApiUrl + "/api/ui-tests")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
            log.info("요청 ID {}에 대해 FastAPI가 성공적으로 트리거되었습니다.", requestId);

        } catch (Exception e) {
            log.error("요청 ID {}에 대해 AI 서버 트리거 실패", requestId, e);
            savedRequest.changeStatus("FAILED");
            savedRequest.changePhase("FAILED");
            testRequestRepository.save(savedRequest);
            throw new RuntimeException("현재 AI 서버를 사용할 수 없습니다: " + e.getMessage(), e);
        }

        return requestId;
    }

    @Transactional(readOnly = true)
    public UIUXTestStatusResponse getTestStatus(UUID requestId) {
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 테스트 요청입니다."));

        if (!"UIUX".equals(testRequest.getTestType())) {
            throw new IllegalArgumentException("해당 요청은 UI 테스트 타입이 아닙니다.");
        }

        String reportMarkdown = "";
        List<Map<String, Object>> stepsList = new java.util.ArrayList<>();
        var reportOpt = UIUXTestReportRepository.findByTestRequestId(requestId);
        if (reportOpt.isPresent()) {
            reportMarkdown = reportOpt.get().getAiUxReview();
            try {
                stepsList = objectMapper.readValue(reportOpt.get().getRawLogs(), new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
            } catch (Exception e) {
                log.warn("테스트 상태 조회를 위한 rawLogs 파싱 실패", e);
            }
        }

        return UIUXTestStatusResponse.builder()
                .requestId(testRequest.getId())
                .status(testRequest.getTestStatus())
                .targetUrl(testRequest.getTargetUrl())
                .report(reportMarkdown)
                .steps(stepsList)
                .build();
    }


    @Transactional
    public void saveReport(UUID requestId, UIUXTestReportSubmitRequest request) {
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 테스트 요청입니다."));

        if (!"UIUX".equals(testRequest.getTestType())) {
            throw new IllegalArgumentException("해당 요청은 UI 테스트 타입이 아닙니다.");
        }

        var reportOpt = UIUXTestReportRepository.findByTestRequestId(requestId);
        UIUXTestReport report;
        if (reportOpt.isPresent()) {
            report = reportOpt.get();
        } else {
            report = UIUXTestReport.builder()
                    .testRequest(testRequest)
                    .totalSteps(0)
                    .defectCount(0)
                    .executionTime(0)
                    .rawLogs("[]")
                    .aiUxReview("")
                    .build();
        }

        UIUXTestReport finalReport = UIUXTestReport.builder()
                .id(report.getId())
                .testRequest(testRequest)
                .totalSteps(report.getTotalSteps())
                .defectCount(report.getDefectCount())
                .executionTime(report.getExecutionTime())
                .rawLogs(report.getRawLogs())
                .aiUxReview(request.getReportMarkdown() != null ? request.getReportMarkdown() : "")
                .build();
        UIUXTestReportRepository.save(finalReport);

        // 핵심 로직: 테스트 완료 상태로 변경하고 최종 Markdown 리뷰 저장
        if (!"FAILED".equals(testRequest.getTestStatus())) {
            testRequest.changeStatus("COMPLETED");
            testRequest.changePhase("FINISHED");
            testRequest.changeProgress(100);
        }
        testRequestRepository.save(testRequest);
        log.info("요청 ID {}에 대한 최종 UI/UX 마크다운 리뷰 저장 및 요청 컨텍스트 완료됨", requestId);
    }

    @Transactional
    public void addStep(UUID requestId, Map<String, Object> request) {
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 테스트 요청입니다."));

        UIUXTestReport report = UIUXTestReportRepository.findByTestRequestId(requestId).orElseGet(() ->
                UIUXTestReportRepository.save(UIUXTestReport.builder()
                        .testRequest(testRequest)
                        .totalSteps(0)
                        .defectCount(0)
                        .executionTime(0)
                        .rawLogs("[]")
                        .aiUxReview("")
                        .build())
        );

        List<Map<String, Object>> logs;
        try {
            logs = objectMapper.readValue(report.getRawLogs(), new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            logs = new java.util.ArrayList<>();
        }

        logs.add(request);

        try {
            report.setRawLogs(objectMapper.writeValueAsString(logs));
            report.setTotalSteps(logs.size());
        } catch (Exception e) {
            log.error("rawLogs 저장 실패", e);
        }

        UIUXTestReportRepository.save(report);

        // 핵심 로직: 첫 스텝이 접수되면 상태를 PENDING에서 RUNNING으로 갱신
        if ("PENDING".equals(testRequest.getTestStatus())) {
            testRequest.changeStatus("RUNNING");
            testRequest.changePhase("EXPLORING");
            testRequestRepository.save(testRequest);
        }
    }

    @Transactional
    public void markAsFailed(UUID requestId, String reason) {
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 테스트 요청입니다."));

        if (!"UIUX".equals(testRequest.getTestType())) {
            throw new IllegalArgumentException("해당 요청은 UI 테스트 타입이 아닙니다.");
        }

        testRequest.changeStatus("FAILED");
        testRequest.changePhase("FAILED");
        testRequestRepository.save(testRequest);

        var reportOpt = UIUXTestReportRepository.findByTestRequestId(requestId);
        UIUXTestReport report;
        if (reportOpt.isPresent()) {
            report = reportOpt.get();
        } else {
            report = UIUXTestReport.builder()
                    .testRequest(testRequest)
                    .totalSteps(0)
                    .defectCount(0)
                    .executionTime(0)
                    .rawLogs("[]")
                    .aiUxReview("")
                    .build();
        }

        String summaryError = report.getAiUxReview();
        if (summaryError == null || summaryError.trim().isEmpty()) {
            summaryError = "# UI Test Audit Report - FAILED\n\n**Reason:** " + reason;
        }

        UIUXTestReport failedReport = UIUXTestReport.builder()
                .id(report.getId())
                .testRequest(testRequest)
                .totalSteps(report.getTotalSteps())
                .defectCount(report.getDefectCount())
                .executionTime(report.getExecutionTime())
                .rawLogs(report.getRawLogs())
                .aiUxReview(summaryError)
                .build();
        UIUXTestReportRepository.save(failedReport);
        log.info("UI 컨텍스트 요청 {}을(를) FAILED로 표시했습니다. 사유: {}", requestId, reason);
    }

    private void deleteVideoFromSupabase(UUID requestId) {
        if (supabaseUrl == null || supabaseUrl.trim().isEmpty() ||
                supabaseAnonKey == null || supabaseAnonKey.trim().isEmpty()) {
            log.warn("Supabase 인증 정보가 완전히 구성되지 않았습니다. 비디오 삭제를 건너뜁니다.");
            return;
        }

        String bucketName = "ui-test-videos";
        String path = requestId.toString() + ".webm";
        String url = supabaseUrl + "/storage/v1/object/" + bucketName + "/" + path;

        try {
            log.info("Supabase 스토리지에서 비디오 삭제 시도 중: {}", url);
            restClient.delete()
                    .uri(url)
                    .header("Authorization", "Bearer " + supabaseAnonKey)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Supabase 스토리지에서 비디오 파일 {} 삭제 성공", path);
        } catch (Exception e) {
            log.error("Supabase 스토리지에서 비디오 파일 {} 삭제 실패 (존재하지 않을 수 있음)", path, e);
        }
    }
}
