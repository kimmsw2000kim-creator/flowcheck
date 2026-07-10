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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UiUxTestService {

    private final UserRepository userRepository;
    private final UserCouponRepository userCouponRepository;
    private final CreditsLedgerRepository creditsLedgerRepository;
    private final TestRequestRepository testRequestRepository;
    private final UiUxTestReportRepository uiUxTestReportRepository;
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

    @Transactional
    public UUID submitUiUxTest(String email, UiUxTestStartRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));

        boolean hasActiveTest = testRequestRepository.existsByUserAndTestTypeAndTestStatusIn(
                user, "UI", List.of("PENDING", "RUNNING"));
        if (hasActiveTest) {
            throw new IllegalStateException("이미 진행 중인 UI 테스트가 있습니다. 완료 후 다시 시도해 주세요.");
        }

        List<TestRequest> userUiRequests = testRequestRepository.findByUserAndTestTypeOrderByCreatedAtAsc(user, "UI");
        if (userUiRequests.size() >= 10) {
            int deleteCount = userUiRequests.size() - 9;
            for (int i = 0; i < deleteCount; i++) {
                TestRequest oldestRequest = userUiRequests.get(i);

                deleteVideoFromSupabase(oldestRequest.getId());

                testRequestRepository.delete(oldestRequest);
                log.info("Deleted oldest UI test request record {} for user {} due to 10-test limit", oldestRequest.getId(), email);
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
                .testType("UIUX")
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

            log.info("Calling FastAPI endpoint /api/ui-tests for requestId: {}", requestId);
            restClient.post()
                    .uri(fastApiUrl + "/api/ui-tests")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
            log.info("FastAPI triggered successfully for requestId: {}", requestId);

        } catch (Exception e) {
            log.error("Failed to trigger AI Server for requestId: {}", requestId, e);
            savedRequest.changeStatus("FAILED");
            savedRequest.changePhase("FAILED");
            testRequestRepository.save(savedRequest);
            throw new RuntimeException("AI server is currently unavailable: " + e.getMessage(), e);
        }

        return requestId;
    }

    @Transactional(readOnly = true)
    public UiUxTestStatusResponse getTestStatus(UUID requestId) {
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 테스트 요청입니다."));

        if (!"UIUX".equals(testRequest.getTestType())) {
            throw new IllegalArgumentException("해당 요청은 UI 테스트 타입이 아닙니다.");
        }

        String reportMarkdown = "";
        List<Map<String, Object>> stepsList = new java.util.ArrayList<>();
        var reportOpt = uiUxTestReportRepository.findByTestRequestId(requestId);
        if (reportOpt.isPresent()) {
            reportMarkdown = reportOpt.get().getAiUxReview();
            try {
                stepsList = objectMapper.readValue(reportOpt.get().getRawLogs(), new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
            } catch (Exception e) {
                log.warn("Failed to parse rawLogs for test status", e);
            }
        }

        return UiUxTestStatusResponse.builder()
                .requestId(testRequest.getId())
                .status(testRequest.getTestStatus())
                .targetUrl(testRequest.getTargetUrl())
                .report(reportMarkdown)
                .steps(stepsList)
                .build();
    }


    @Transactional
    public void saveReport(UUID requestId, UiUxTestReportSubmitRequest request) {
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 테스트 요청입니다."));

        if (!"UIUX".equals(testRequest.getTestType())) {
            throw new IllegalArgumentException("해당 요청은 UI 테스트 타입이 아닙니다.");
        }

        var reportOpt = uiUxTestReportRepository.findByTestRequestId(requestId);
        UiUxTestReport report;
        if (reportOpt.isPresent()) {
            report = reportOpt.get();
        } else {
            report = UiUxTestReport.builder()
                    .testRequest(testRequest)
                    .totalSteps(0)
                    .defectCount(0)
                    .executionTime(0)
                    .rawLogs("[]")
                    .aiUxReview("")
                    .build();
        }

        UiUxTestReport finalReport = UiUxTestReport.builder()
                .id(report.getId())
                .testRequest(testRequest)
                .totalSteps(report.getTotalSteps())
                .defectCount(report.getDefectCount())
                .executionTime(report.getExecutionTime())
                .rawLogs(report.getRawLogs())
                .aiUxReview(request.getReportMarkdown() != null ? request.getReportMarkdown() : "")
                .build();
        uiUxTestReportRepository.save(finalReport);

        if (!"FAILED".equals(testRequest.getTestStatus())) {
            testRequest.changeStatus("COMPLETED");
            testRequest.changePhase("FINISHED");
            testRequest.changeProgress(100);
        }
        testRequestRepository.save(testRequest);
        log.info("Saved final UI/UX markdown review and completed request context for requestId: {}", requestId);
    }

    @Transactional
    public void addStep(UUID requestId, Map<String, Object> request) {
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 테스트 요청입니다."));

        UiUxTestReport report = uiUxTestReportRepository.findByTestRequestId(requestId).orElseGet(() ->
                uiUxTestReportRepository.save(UiUxTestReport.builder()
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
            log.error("Failed to write rawLogs", e);
        }

        uiUxTestReportRepository.save(report);

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

        var reportOpt = uiUxTestReportRepository.findByTestRequestId(requestId);
        UiUxTestReport report;
        if (reportOpt.isPresent()) {
            report = reportOpt.get();
        } else {
            report = UiUxTestReport.builder()
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

        UiUxTestReport failedReport = UiUxTestReport.builder()
                .id(report.getId())
                .testRequest(testRequest)
                .totalSteps(report.getTotalSteps())
                .defectCount(report.getDefectCount())
                .executionTime(report.getExecutionTime())
                .rawLogs(report.getRawLogs())
                .aiUxReview(summaryError)
                .build();
        uiUxTestReportRepository.save(failedReport);
        log.info("Marked UI context request {} as FAILED. Reason: {}", requestId, reason);
    }

    private void deleteVideoFromSupabase(UUID requestId) {
        if (supabaseUrl == null || supabaseUrl.trim().isEmpty() ||
                supabaseAnonKey == null || supabaseAnonKey.trim().isEmpty()) {
            log.warn("Supabase credentials not fully configured. Skipping video deletion.");
            return;
        }

        String bucketName = "ui-test-videos";
        String path = requestId.toString() + ".webm";
        String url = supabaseUrl + "/storage/v1/object/" + bucketName + "/" + path;

        try {
            log.info("Attempting to delete video from Supabase Storage: {}", url);
            restClient.delete()
                    .uri(url)
                    .header("Authorization", "Bearer " + supabaseAnonKey)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Successfully deleted video file {} from Supabase Storage", path);
        } catch (Exception e) {
            log.error("Failed to delete video file {} from Supabase Storage (it might not exist)", path, e);
        }
    }
}