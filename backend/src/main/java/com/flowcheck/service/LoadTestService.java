package com.flowcheck.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowcheck.domain.*;
import com.flowcheck.dto.LoadTest.LoadTestRequest;
import com.flowcheck.dto.LoadTest.LoadTestResponse;
import com.flowcheck.dto.LoadTest.LoadTestSubmittedEvent;
import com.flowcheck.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LoadTestService {

        private final UserRepository userRepository;
        private final UserCouponRepository userCouponRepository;
        private final CreditsLedgerRepository creditsLedgerRepository;
        private final TestRequestRepository testRequestRepository;
        private final LoadTestReportRepository loadTestReportRepository;
        private final LoadTestStreamService loadTestStreamService;
        private final CouponUsageLogRepository couponUsageLogRepository;

        private final ApplicationEventPublisher eventPublisher;

        private final ObjectMapper objectMapper;

        @Value("${fastapi.url}")
        private String fastApiUrl;

        // TODO: 하드 코딩이라서 바꿔야 함
        private static final int TEST_COST = 10_000;

        @Transactional
        public UUID submitLoadTest(UUID userId, LoadTestRequest request) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new IllegalArgumentException("User not found"));

                String safePrompt = request.getLoadPrompt() != null ? request.getLoadPrompt() : "";
                TestRequest testHistory = TestRequest.builder()
                                .user(user)
                                .targetUrl(request.getTargetUrl())
                                .promptInput(safePrompt)
                                .testStatus("PENDING")
                                .updatedAt(OffsetDateTime.now())
                                .build();

                List<UserCoupon> availableCoupons = userCouponRepository
                                .findByUserAndCoupon_CouponTypeAndRemainingChancesGreaterThanOrderByCreatedAtAsc(user,
                                                CouponType.LOAD_TEST, 0);

                if (!availableCoupons.isEmpty()) {
                        // 쿠폰 사용
                        UserCoupon couponToUse = availableCoupons.getFirst();
                        couponToUse.useChance();

                        couponUsageLogRepository.save(CouponUsageLog.builder()
                                .user(user)
                                .couponType(CouponType.LOAD_TEST)
                                .description("부하 테스트 실행 (" + request.getTargetUrl() + ")")
                                .build());

                } else if (user.getBalance() >= TEST_COST) {
                        // 잔액 사용
                        user.deductBalance(TEST_COST);
                        CreditsLedger ledger = CreditsLedger.builder()
                                        .user(user)
                                        .amount(-TEST_COST)
                                        .transactionType("TEST_CONSUME")
                                        .description("k6 Load Test Execution on AWS")
                                        .build();
                        creditsLedgerRepository.save(ledger);
                } else {
                        throw new IllegalStateException("Insufficient coupons or balance.");
                }

                TestRequest savedRequest = testRequestRepository.save(testHistory);
                UUID generatedRequestId = savedRequest.getId();

                loadTestStreamService.updateProgress(generatedRequestId,
                                new com.flowcheck.dto.LoadTest.LoadTestProgressUpdateRequest(
                                                "PENDING",
                                                "QUEUED",
                                                0,
                                                "부하 테스트가 대기 중입니다."));

                // FastAPI 호출 위임
                eventPublisher.publishEvent(new LoadTestSubmittedEvent(generatedRequestId, request));

                return generatedRequestId;
        }

        @Transactional(readOnly = true)
        public LoadTestResponse getTestResult(UUID requestId) {
                TestRequest testRequest = testRequestRepository.findById(requestId)
                                .orElseThrow(() -> new IllegalArgumentException("Invalid request ID"));

                String currentStatus = testRequest.getTestStatus();
                String currentPhase = testRequest.getTestPhase();
                Integer currentProgress = testRequest.getTestProgress();

                if (!"COMPLETED".equals(currentStatus)) {
                        String message = buildPhaseMessage(currentStatus, currentPhase);

                        return LoadTestResponse.builder()
                                        .status(currentStatus)
                                        .phase(currentPhase)
                                        .progress(currentProgress)
                                        .message(message)
                                        .build();
                }

                LoadTestReport report = loadTestReportRepository.findByTestRequestId(requestId)
                                .orElseThrow(() -> new IllegalStateException(
                                                "Report should exist for COMPLETED request"));

                Object pointsObj = report.getRawMetrics().get("points");
                List<LoadTestResponse.ChartPoint> chartPoints = objectMapper.convertValue(
                                pointsObj,
                                new TypeReference<List<LoadTestResponse.ChartPoint>>() {
                                });

                LoadTestResponse.TestResults resultsDto = LoadTestResponse.TestResults.builder()
                                .maxTps(report.getTotalTps().intValue())
                                .avgResponse(report.getAvgLatency() / 1000.0) // 다시 초 단위로 변환 예시
                                .errorRate(report.getErrorRate().doubleValue())
                                .bottleneckComment(report.getAiPerformanceReview())
                                .points(chartPoints)
                                .build();

                return LoadTestResponse.builder()
                                .status(currentStatus)
                                .phase(currentPhase)
                                .progress(currentProgress)
                                .message("부하 테스트가 완료되었습니다.")
                                .testResults(resultsDto)
                                .build();
        }

        private String buildPhaseMessage(String status, String phase) {
                if ("FAILED".equals(status)) {
                        return "부하 테스트가 실패했습니다.";
                }

                return switch (phase) {
                        case "PREPARING_REQUEST" -> "요청 정보를 준비하는 중입니다.";
                        case "CALLING_FASTAPI" -> "FastAPI에 부하 테스트 실행을 전달하는 중입니다.";
                        case "PROCESSING_RESULTS" -> "k6 결과를 해석하는 중입니다.";
                        case "SAVING_REPORT" -> "결과 리포트를 저장하는 중입니다.";
                        case "COMPLETED" -> "부하 테스트가 완료되었습니다.";
                        default -> "부하 테스트가 대기 중입니다.";
                };
        }
}
