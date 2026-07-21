package com.flowcheck.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowcheck.domain.*;
import com.flowcheck.dto.LoadTest.LoadTestMetricsDocument;
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
import java.util.Collections;
import java.util.List;
import java.util.Map;
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
                                .orElseThrow(() -> new IllegalArgumentException("사용자 정보를 찾을 수 없습니다."));

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
                        throw new IllegalStateException("부하 테스트 쿠폰 또는 크레딧 잔액이 부족합니다.");
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
                                                "부하 테스트 결과를 찾을 수 없습니다."));

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
                                                "완료된 부하 테스트의 리포트를 찾을 수 없습니다."));

                Map<String, Object> rawMetrics = report.getRawMetrics();
                int schemaVersion = getIntValue(rawMetrics.get("schemaVersion"), 1);
                boolean hasSupportedSeriesContract =
                                schemaVersion >= LoadTestMetricsDocument.MIN_SUPPORTED_SCHEMA_VERSION
                                                && schemaVersion <= LoadTestMetricsDocument.CURRENT_SCHEMA_VERSION;
                boolean hasUnsupportedFutureContract =
                                schemaVersion > LoadTestMetricsDocument.CURRENT_SCHEMA_VERSION;

                LoadTestMetricsDocument metricsDocument = hasSupportedSeriesContract
                                ? objectMapper.convertValue(rawMetrics, LoadTestMetricsDocument.class)
                                : null;
                LoadTestMetricsDocument.Summary storedSummary = metricsDocument != null
                                ? metricsDocument.summary()
                                : null;

                List<LoadTestResponse.ChartPoint> chartPoints =
                                metricsDocument != null && metricsDocument.points() != null
                                                ? metricsDocument.points()
                                                : Collections.emptyList();
                Long totalRequests = storedSummary != null ? storedSummary.totalRequests() : null;
                double avgTps = storedSummary != null && storedSummary.avgTps() != null
                                ? storedSummary.avgTps()
                                : report.getTotalTps().doubleValue();
                Integer maxTps = storedSummary != null ? storedSummary.maxTps() : null;
                Double p95Response = storedSummary != null ? storedSummary.p95Response() : null;
                Integer bucketSeconds = metricsDocument != null
                                ? metricsDocument.bucketSeconds()
                                : null;

                String metricsStatus;
                String metricsWarning;
                String dataOrigin;
                if (hasSupportedSeriesContract) {
                        metricsStatus = getStringValue(metricsDocument.metricsStatus(), "UNAVAILABLE");
                        metricsWarning = getStringValue(metricsDocument.metricsWarning(), null);
                        dataOrigin = getStringValue(metricsDocument.dataOrigin(), "NOT_COLLECTED");
                } else if (hasUnsupportedFutureContract) {
                        metricsStatus = "UNSUPPORTED_SCHEMA";
                        metricsWarning = "현재 서버가 지원하지 않는 시계열 스키마 버전입니다.";
                        dataOrigin = "UNKNOWN";
                } else {
                        metricsStatus = "LEGACY_UNVERIFIED";
                        metricsWarning = "이 결과는 이전 측정 형식으로 생성되어 실제 시계열을 제공하지 않습니다.";
                        dataOrigin = "LEGACY_SYNTHETIC";
                }

                double avgResponse = report.getAvgLatency() / 1000.0;
                double errorRate = report.getErrorRate().doubleValue();
                PerformanceAssessment assessment = calculatePerformanceAssessment(
                                avgResponse,
                                errorRate);
                LoadTestMetricsDocument.ScoreBreakdown storedBreakdown = metricsDocument != null
                                ? metricsDocument.scoreBreakdown()
                                : null;
                LoadTestResponse.ScoreBreakdown responseBreakdown = storedBreakdown != null
                                ? LoadTestResponse.ScoreBreakdown.builder()
                                                .reliabilityScore(storedBreakdown.reliabilityScore())
                                                .latencyScore(storedBreakdown.latencyScore())
                                                .scalabilityScore(storedBreakdown.scalabilityScore())
                                                .build()
                                : LoadTestResponse.ScoreBreakdown.builder()
                                                .reliabilityScore(assessment.reliabilityScore())
                                                .latencyScore(assessment.latencyScore())
                                                .build();
                int performanceScore = metricsDocument != null && metricsDocument.performanceScore() != null
                                ? metricsDocument.performanceScore()
                                : assessment.score();
                String performanceGrade = metricsDocument != null && metricsDocument.performanceGrade() != null
                                ? metricsDocument.performanceGrade()
                                : assessment.grade();
                String scoreLabel = metricsDocument != null && metricsDocument.scoreLabel() != null
                                ? metricsDocument.scoreLabel()
                                : assessment.label();

                LoadTestResponse.TestResults resultsDto = LoadTestResponse.TestResults.builder()
                                .totalRequests(totalRequests)
                                .avgTps(avgTps)
                                .maxTps(maxTps)
                                .avgResponse(avgResponse)
                                .p95Response(p95Response)
                                .errorRate(errorRate)
                                .performanceScore(performanceScore)
                                .performanceGrade(performanceGrade)
                                .scoreLabel(scoreLabel)
                                .scoreBreakdown(responseBreakdown)
                                .scoreVersion(metricsDocument != null && metricsDocument.scoreVersion() != null
                                                ? metricsDocument.scoreVersion()
                                                : 1)
                                .scoreStatus(metricsDocument != null
                                                ? getStringValue(metricsDocument.scoreStatus(), "LEGACY_V1")
                                                : "LEGACY_V1")
                                .scoreTargets(metricsDocument != null ? metricsDocument.scoreTargets() : null)
                                .bottleneckComment(report.getAiPerformanceReview())
                                .analysisReport(metricsDocument != null ? metricsDocument.analysisReport() : null)
                                .diagnosticMetrics(metricsDocument != null ? metricsDocument.diagnosticMetrics() : null)
                                .points(chartPoints)
                                .metricsStatus(metricsStatus)
                                .metricsWarning(metricsWarning)
                                .dataOrigin(dataOrigin)
                                .bucketSeconds(bucketSeconds)
                                .metricsSchemaVersion(schemaVersion)
                                .build();

                return LoadTestResponse.builder()
                                .status(currentStatus)
                                .phase(currentPhase)
                                .progress(currentProgress)
                                .message("부하 테스트가 완료되었습니다.")
                                .testResults(resultsDto)
                                .build();
        }

        private int getIntValue(Object value, int fallback) {
                return value instanceof Number number ? number.intValue() : fallback;
        }

        private String getStringValue(Object value, String fallback) {
                return value instanceof String stringValue && !stringValue.isBlank()
                                ? stringValue
                                : fallback;
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
