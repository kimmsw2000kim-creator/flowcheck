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

    private static final int TEST_COST = 10_000;

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

        // 2. 비용 차감 (쿠폰 및 크레딧 차감 로직 제거 - 무료 작동)
        // 기존의 쿠폰 및 크레딧 차감 로직이 이곳에 위치하였으나 삭제되었습니다.


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
                    "targetUrl", request.getTargetUrl()
            );

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
}
