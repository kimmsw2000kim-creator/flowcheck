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
    private final CouponUsageLogRepository couponUsageLogRepository;

    @Value("${fastapi.url}")
    private String fastApiUrl;

    @Value("${supabase.url:}")
    private String supabaseUrl;

    @Value("${supabase.anon-key:}")
    private String supabaseAnonKey;

    private static final int TEST_COST = 1_000;

    @Transactional
    public UUID submitUiTest(String email, UiTestStartRequest request) {
        // 1. 유저 조회
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));

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
                        email);
            }
        }

        // 2. 비용 차감 (UI_UX_TEST 쿠폰 우선 차감, 없을 경우 크레딧 차감)
        List<UserCoupon> availableCoupons = userCouponRepository
                .findByUserAndCoupon_CouponTypeAndRemainingChancesGreaterThanOrderByCreatedAtAsc(user, CouponType.UI_UX_TEST, 0);

        if (!availableCoupons.isEmpty()) {
            // 쿠폰 사용
            UserCoupon couponToUse = availableCoupons.getFirst();
            couponToUse.useChance();

            couponUsageLogRepository.save(CouponUsageLog.builder()
                .user(user)
                .couponType(CouponType.UI_UX_TEST)
                .description("UI/UX 테스트 실행 (" + request.getTargetUrl() + ")")
                .build());
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
            throw new IllegalStateException("UI/UX 테스트 쿠폰 또는 크레딧 잔액이 부족합니다.");
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

    /**
     * UI 테스트의 현재 상태 및 지금까지 진행된 스텝 기록을 조회합니다.
     * 프론트엔드에서 폴링(Polling) 방식으로 테스트 진행 상황을 화면에 렌더링할 때 사용됩니다.
     */
    @Transactional(readOnly = true)
    public UiTestStatusResponse getTestStatus(UUID requestId) {
        UiTest uiTest = uiTestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 테스트 요청입니다."));

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

    /**
     * AI 에이전트(FastAPI)가 탐색 과정에서 한 스텝을 수행할 때마다 호출하여 결과를 기록합니다.
     * 첫 스텝 도착 시 테스트 상태를 PENDING에서 RUNNING으로 변경합니다.
     */
    @Transactional
    public void addStep(UUID requestId, UiTestStepSubmitRequest request) {
        UiTest uiTest = uiTestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 테스트 요청입니다."));

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

    /**
     * AI 에이전트가 탐색을 모두 마치고 최종 마크다운 분석 보고서를 제출할 때 호출됩니다.
     * 보고서를 저장하고 테스트 상태를 COMPLETED로 변경하여 테스트를 공식적으로 종료합니다.
     */
    @Transactional
    public void saveReport(UUID requestId, UiTestReportSubmitRequest request) {
        UiTest uiTest = uiTestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 테스트 요청입니다."));

        uiTest.setReport(request.getReportMarkdown());

        // 최종 레포트 저장 시 상태를 COMPLETED로 변경 (만약 오류만 수집되었거나 특정 비정상 종료 시 FAILED로 분기 가능)
        if (uiTest.getStatus().equals("FAILED") == false) {
            uiTest.changeStatus("COMPLETED");
        }
        uiTestRepository.save(uiTest);
        log.info("Saved final report and completed UI test for requestId: {}", requestId);
    }

    /**
     * AI 서버에서 치명적인 오류가 발생하여 탐색을 지속할 수 없을 때 호출됩니다.
     * 테스트를 즉시 FAILED 상태로 마킹하고, 실패 사유를 리포트에 남깁니다.
     */
    @Transactional
    public void markAsFailed(UUID requestId, String reason) {
        UiTest uiTest = uiTestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 테스트 요청입니다."));

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
