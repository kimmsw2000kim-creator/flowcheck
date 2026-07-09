package com.flowcheck.service;

import com.flowcheck.domain.*;
import com.flowcheck.dto.uitest.*;
import com.flowcheck.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UiTestService {

    private final UserRepository userRepository;
    private final UserCouponRepository userCouponRepository;
    private final CreditsLedgerRepository creditsLedgerRepository;
    private final UiTestRepository uiTestRepository;
    private final UiTestStepRepository uiTestStepRepository;
    private final RestClient restClient;

    @Value("${fastapi.url}")
    private String fastApiUrl;

    @Value("${supabase.url:}")
    private String supabaseUrl;

    @Value("${supabase.anon-key:}")
    private String supabaseAnonKey;

    private static final int TEST_COST = 1_000;

    @Transactional
    public UUID submitUiTest(UUID userId, UiTestStartRequest request) {
        // 1. 유저 조회 또는 자동 생성 (로컬 테스트 및 빠른 수동 검증의 편의를 위해 없을 경우 생성)
        User user = userRepository.findById(userId)
                .orElseGet(() -> {
                    log.info("User {} not found, creating dynamic mock user.", userId);
                    User newUser = User.builder()
                            .userId(userId)
                            .email("corp-user@flowcheck.com")
                            .balance(100_000)
                            .role(Role.USER)
                            .status(UserStatus.ACTIVE)
                            .build();
                    return userRepository.save(newUser);
                });

        // ✅ 동일 유저가 이미 PENDING/RUNNING 테스트를 가지고 있으면 중복 실행 차단
        boolean hasActiveTest = uiTestRepository.existsByUserAndStatusIn(
                user, List.of("PENDING", "RUNNING"));
        if (hasActiveTest) {
            throw new IllegalStateException("이미 진행 중인 UI 테스트가 있습니다. 완료 후 다시 시도해 주세요.");
        }

        // 계정당 최대 10개의 UI 테스트 동영상/이력만 유지하도록 제한 (10개 초과 시 오래된 항목 및 동영상 삭제)
        List<UiTest> userTests = uiTestRepository.findByUserOrderByCreatedAtAsc(user);
        if (userTests.size() >= 10) {
            int deleteCount = userTests.size() - 9; // 새 항목이 추가되어 정확히 10개가 되도록 초과분 삭제
            for (int i = 0; i < deleteCount; i++) {
                UiTest oldestTest = userTests.get(i);

                // Supabase Storage에서 동영상 파일 제거
                deleteVideoFromSupabase(oldestTest.getId());

                // DB에서 레코드 삭제 (Cascade 설정에 의해 ui_test_steps도 자동 삭제됨)
                uiTestRepository.delete(oldestTest);
                log.info("Deleted oldest UI test record {} for user {} due to 10-test limit", oldestTest.getId(),
                        userId);
            }
        }

        // 2. 비용 차감 (UI_UX_TEST 쿠폰 우선 차감, 없을 경우 크레딧 차감)
        List<UserCoupon> availableCoupons = userCouponRepository
                .findByUserAndCoupon_CouponTypeAndRemainingChancesGreaterThanOrderByCreatedAtAsc(user, CouponType.UI_UX_TEST, 0);

        if (!availableCoupons.isEmpty()) {
            // 쿠폰 사용
            UserCoupon couponToUse = availableCoupons.getFirst();
            couponToUse.useChance();
        } else if (user.getBalance() >= TEST_COST) {
            // 잔액 사용
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
            throw new IllegalStateException("Insufficient coupons or balance.");
        }

        // 3. 테스트 이력 생성 (PENDING)
        UiTest uiTest = UiTest.builder()
                .user(user)
                .targetUrl(request.getTargetUrl())
                .status("PENDING")
                .build();
        UiTest savedTest = uiTestRepository.save(uiTest);
        UUID requestId = savedTest.getId();

        // 4. FastAPI 비동기 조작 루프 트리거
        try {
            Map<String, String> payload = Map.of(
                    "requestId", requestId.toString(),
                    "targetUrl", request.getTargetUrl());

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
            savedTest.changeStatus("FAILED");
            uiTestRepository.save(savedTest);
            throw new RuntimeException("AI server is currently unavailable: " + e.getMessage(), e);
        }

        return requestId;
    }

    @Transactional(readOnly = true)
    public UiTestStatusResponse getTestStatus(UUID requestId) {
        UiTest uiTest = uiTestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Test request not found."));

        List<UiTestStep> steps = uiTestStepRepository.findByUiTestOrderByStepAsc(uiTest);
        List<UiTestStepDTO> stepDtos = steps.stream()
                .map(step -> UiTestStepDTO.builder()
                        .step(step.getStep())
                        .url(step.getUrl())
                        .action(step.getAction())
                        .selector(step.getSelector())
                        .text(step.getText())
                        .reason(step.getReason())
                        .error(step.getError())
                        .build())
                .toList();

        return UiTestStatusResponse.builder()
                .requestId(uiTest.getId())
                .status(uiTest.getStatus())
                .targetUrl(uiTest.getTargetUrl())
                .report(uiTest.getReport())
                .steps(stepDtos)
                .build();
    }

    @Transactional
    public void addStep(UUID requestId, UiTestStepSubmitRequest request) {
        UiTest uiTest = uiTestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Test request not found."));

        // 첫 번째 스텝이 오거나 PENDING 상태이면 RUNNING 상태로 업데이트
        if ("PENDING".equals(uiTest.getStatus())) {
            uiTest.changeStatus("RUNNING");
            uiTestRepository.save(uiTest);
        }

        UiTestStep step = UiTestStep.builder()
                .uiTest(uiTest)
                .step(request.getStep())
                .url(request.getUrl())
                .action(request.getAction())
                .selector(request.getSelector())
                .text(request.getText())
                .reason(request.getReason())
                .error(request.getError())
                .build();
        uiTestStepRepository.save(step);
        log.info("Saved step {} for requestId: {}", request.getStep(), requestId);
    }

    @Transactional
    public void saveReport(UUID requestId, UiTestReportSubmitRequest request) {
        UiTest uiTest = uiTestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Test request not found."));

        uiTest.setReport(request.getReportMarkdown());

        // 최종 레포트 저장 시 상태를 COMPLETED로 변경 (만약 오류만 수집되었거나 특정 비정상 종료 시 FAILED로 분기 가능)
        if (uiTest.getStatus().equals("FAILED") == false) {
            uiTest.changeStatus("COMPLETED");
        }
        uiTestRepository.save(uiTest);
        log.info("Saved final report and completed UI test for requestId: {}", requestId);
    }

    @Transactional
    public void markAsFailed(UUID requestId, String reason) {
        UiTest uiTest = uiTestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Test request not found."));

        uiTest.changeStatus("FAILED");
        if (uiTest.getReport() == null) {
            uiTest.setReport("# UI Test Audit Report - FAILED\n\n**Reason:** " + reason);
        }
        uiTestRepository.save(uiTest);
        log.info("Marked UI test {} as FAILED. Reason: {}", requestId, reason);
    }

    /**
     * Supabase Storage에서 이전 UI 테스트 비디오 파일을 원격 삭제합니다.
     */
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
