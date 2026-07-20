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
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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
                                // 테스트 종류 추가
                                .testType("LOAD")
                                .testStatus("PENDING")
                                .updatedAt(OffsetDateTime.now())
                                .build();
                TestRequest savedRequest = testRequestRepository.save(testHistory);
                UUID generatedRequestId = savedRequest.getId();

                List<UserCoupon> availableCoupons = userCouponRepository
                                .findByUserAndCoupon_CouponTypeAndRemainingChancesGreaterThanOrderByCreatedAtAsc(user,
                                                CouponType.LOAD_TEST, 0);

                if (!availableCoupons.isEmpty()) {
                        // 쿠폰 사용
                        UserCoupon couponToUse = availableCoupons.getFirst();
                        couponToUse.useChance();

                        couponUsageLogRepository.save(CouponUsageLog.builder()
                                .user(user)
                                .testRequest(savedRequest)
                                .userCoupon(couponToUse)
                                .couponType(CouponType.LOAD_TEST)
                                .action(CouponUsageAction.USE)
                                .description("부하 테스트 실행 (" + request.getTargetUrl() + ")")
                                .build());

                } else if (user.getBalance() >= TEST_COST) {
                        // 잔액 사용
                        user.deductBalance(TEST_COST);
                        CreditsLedger ledger = CreditsLedger.builder()
                                        .user(user)
                                        .testRequest(savedRequest)
                                        .amount(-TEST_COST)
                                        .transactionType(CreditTransactionType.TEST_CONSUME)
                                        .description("k6 Load Test Execution on AWS")
                                        .build();
                        creditsLedgerRepository.save(ledger);
                } else {
                        throw new IllegalStateException("Insufficient coupons or balance.");
                }

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
        public LoadTestResponse getTestResult(UUID userId, UUID requestId) {
                TestRequest testRequest = testRequestRepository
                                .findByIdAndUser_UserIdAndTestType(requestId, userId, "LOAD")
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Load test not found"));

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

                double avgResponse = report.getAvgLatency() / 1000.0;
                double errorRate = report.getErrorRate().doubleValue();
                PerformanceAssessment assessment = calculatePerformanceAssessment(
                                avgResponse,
                                errorRate);

                LoadTestResponse.TestResults resultsDto = LoadTestResponse.TestResults.builder()
                                .maxTps(report.getTotalTps().intValue())
                                .avgResponse(avgResponse)
                                .errorRate(errorRate)
                                .performanceScore(assessment.score())
                                .performanceGrade(assessment.grade())
                                .scoreLabel(assessment.label())
                                .scoreBreakdown(LoadTestResponse.ScoreBreakdown.builder()
                                                .reliabilityScore(assessment.reliabilityScore())
                                                .latencyScore(assessment.latencyScore())
                                                .build())
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

        private PerformanceAssessment calculatePerformanceAssessment(double avgResponse, double errorRate) {
                int reliabilityScore;
                int latencyScore;

                if (errorRate >= 99) {
                        reliabilityScore = 0;
                        latencyScore = 0;
                } else {
                        reliabilityScore = roundScore(60 * Math.max(0, 1 - (Math.max(0, errorRate) / 5)));
                        double latencyPoints;

                        if (avgResponse <= 200) {
                                latencyPoints = 40;
                        } else if (avgResponse <= 500) {
                                latencyPoints = 40 - ((avgResponse - 200) / 300 * 10);
                        } else if (avgResponse <= 1000) {
                                latencyPoints = 30 - ((avgResponse - 500) / 500 * 15);
                        } else if (avgResponse < 2000) {
                                latencyPoints = 15 - ((avgResponse - 1000) / 1000 * 15);
                        } else {
                                latencyPoints = 0;
                        }

                        latencyScore = roundScore(Math.max(0, latencyPoints));
                }

                int score = Math.max(0, Math.min(100, reliabilityScore + latencyScore));

                if (score >= 90) {
                        return new PerformanceAssessment(score, "A", "우수", reliabilityScore, latencyScore);
                }
                if (score >= 80) {
                        return new PerformanceAssessment(score, "B", "양호", reliabilityScore, latencyScore);
                }
                if (score >= 70) {
                        return new PerformanceAssessment(score, "C", "보통", reliabilityScore, latencyScore);
                }
                if (score >= 60) {
                        return new PerformanceAssessment(score, "D", "개선 필요", reliabilityScore, latencyScore);
                }
                return new PerformanceAssessment(score, "F", "위험", reliabilityScore, latencyScore);
        }

        private int roundScore(double value) {
                return (int) Math.floor(value + 0.5);
        }

        private record PerformanceAssessment(
                        int score,
                        String grade,
                        String label,
                        int reliabilityScore,
                        int latencyScore) {
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
