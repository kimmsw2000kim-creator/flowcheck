package com.flowcheck.service;

import com.flowcheck.domain.*;
import com.flowcheck.dto.uiuxtest.*;
import com.flowcheck.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.OffsetDateTime;

import java.net.URI;
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
    private final UIUXTestDefectRepository uiuxTestDefectRepository;
    private final RestClient restClient;
    private final CouponUsageLogRepository couponUsageLogRepository;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;

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
            throw new IllegalStateException("이미 진행 중인 UI/UX 테스트가 있습니다. 완료 후 다시 시도해 주세요.");
        }

        List<TestRequest> userUiRequests = testRequestRepository.findByUserAndTestTypeOrderByCreatedAtAsc(user, TEST_TYPE_UIUX);
        if (userUiRequests.size() >= 10) {
            int deleteCount = userUiRequests.size() - 9;
            for (int i = 0; i < deleteCount; i++) {
                TestRequest oldestRequest = userUiRequests.get(i);

                deleteVideoFromSupabase(oldestRequest.getId());

                testRequestRepository.delete(oldestRequest);
                log.info("10개 테스트 제한으로 인해 사용자 {}의 가장 오래된 UI/UX 테스트 요청 기록 {}을 삭제했습니다.", userId, oldestRequest.getId());
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

        eventPublisher.publishEvent(new UIUXTestSubmittedEvent(requestId, request));
        return requestId;
    }

    @Transactional(readOnly = true)
    public UIUXTestStatusResponse getTestStatus(UUID requestId) {
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 테스트 요청입니다."));

        if (!"UIUX".equals(testRequest.getTestType())) {
            throw new IllegalArgumentException("해당 요청은 UI/UX 테스트 요청이 아닙니다.");
        }

        return buildTestStatus(testRequest);
    }

    @Transactional(readOnly = true)
    public UIUXTestStatusResponse getTestStatusForUser(UUID userId, UUID requestId) {
        TestRequest testRequest = testRequestRepository.findByIdAndUser_UserIdAndTestType(requestId, userId, TEST_TYPE_UIUX)
                .orElseThrow(() -> new IllegalArgumentException("UI/UX 테스트 결과를 찾을 수 없습니다."));

        return buildTestStatus(testRequest);
    }

    private UIUXTestStatusResponse buildTestStatus(TestRequest testRequest) {
        UUID requestId = testRequest.getId();
        String reportMarkdown = "";
        List<Map<String, Object>> stepsList = new java.util.ArrayList<>();
        String videoUrl = null;
        Map<String, Object> deviceInfo = null;
        UIUXTestStatusResponse.ScoresDto scores = null;
        Map<String, Object> scoreBreakdown = null;
        String evaluationVersion = null;
        List<UIUXTestStatusResponse.DefectDto> defectDtos = new java.util.ArrayList<>();
        
        var reportOpt = UIUXTestReportRepository.findByTestRequestId(requestId);
        if (reportOpt.isPresent()) {
            UIUXTestReport report = reportOpt.get();
            reportMarkdown = report.getUiuxTestReview() != null ? report.getUiuxTestReview() : "";
            try {
                stepsList = objectMapper.readValue(report.getRawLogs(), new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
            } catch (Exception e) {
                log.warn("테스트 상태 조회를 위한 rawLogs 파싱 실패", e);
            }
            videoUrl = report.getVideoUrl();
            try {
                if (report.getDeviceInfo() != null) {
                    deviceInfo = objectMapper.readValue(report.getDeviceInfo(), new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
                }
            } catch (Exception e) {
                log.warn("deviceInfo 파싱 실패", e);
            }
            if (report.getScoreUsability() != null) {
                scores = UIUXTestStatusResponse.ScoresDto.builder()
                        .usability(report.getScoreUsability())
                        .accessibility(report.getScoreAccessibility())
                        .efficiency(report.getScoreEfficiency())
                        .performance(report.getScorePerformance())
                        .bestPractices(report.getScoreBestPractices())
                        .overall(report.getOverallScore())
                        .build();
            }
            try {
                if (report.getScoreBreakdown() != null) {
                    scoreBreakdown = objectMapper.readValue(report.getScoreBreakdown(), new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
                }
            } catch (Exception e) {
                log.warn("scoreBreakdown 파싱 실패", e);
            }
            evaluationVersion = report.getEvaluationVersion();
            
            List<UIUXTestDefect> defects = uiuxTestDefectRepository.findByTestRequestId(requestId);
            for (UIUXTestDefect defect : defects) {
                Map<String, Object> evidence = null;
                try {
                    if (defect.getEvidence() != null) {
                        evidence = objectMapper.readValue(defect.getEvidence(), new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
                    }
                } catch (Exception e) {
                    log.warn("defect evidence 파싱 실패. defectId={}", defect.getId(), e);
                }
                defectDtos.add(UIUXTestStatusResponse.DefectDto.builder()
                        .id(defect.getId())
                        .category(defect.getCategory())
                        .selector(defect.getSelector())
                        .severity(defect.getSeverity())
                        .description(defect.getDescription())
                        .timestampOffset(defect.getTimestampOffset())
                        .source(defect.getSource())
                        .ruleId(defect.getRuleId())
                        .evidence(evidence)
                        .recommendation(defect.getRecommendation())
                        .screenshotUrl(defect.getScreenshotUrl())
                        .build());
            }
        }

        return UIUXTestStatusResponse.builder()
                .requestId(testRequest.getId())
                .status(testRequest.getTestStatus())
                .targetUrl(testRequest.getTargetUrl())
                .report(reportMarkdown)
                .steps(stepsList)
                .scores(scores)
                .scoreBreakdown(scoreBreakdown)
                .evaluationVersion(evaluationVersion)
                .videoUrl(videoUrl)
                .deviceInfo(deviceInfo)
                .defects(defectDtos)
                .build();
    }


    @Transactional
    public void saveReport(UUID requestId, UIUXTestReportSubmitRequest request) {
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 테스트 요청입니다."));

        if (!"UIUX".equals(testRequest.getTestType())) {
            throw new IllegalArgumentException("해당 요청은 UI/UX 테스트 요청이 아닙니다.");
        }

        var reportOpt = UIUXTestReportRepository.findByTestRequestId(requestId);
        UIUXTestReport report = reportOpt.orElseGet(() -> UIUXTestReport.builder()
                .testRequest(testRequest)
                .scoreUsability(0)
                .scoreAccessibility(0)
                .scoreEfficiency(0)
                .scorePerformance(0)
                .scoreBestPractices(0)
                .overallScore(0)
                .evaluationVersion("v1")
                .rawLogs("[]")
                .uiuxTestReview("")
                .build());

        report.setVideoUrl(request.getVideoUrl());
        if (request.getUiuxTestReview() != null) {
            report.setUiuxTestReview(request.getUiuxTestReview());
        }
        
        if (request.getScores() != null) {
            report.setScoreUsability(intOrZero(request.getScores().getUsability()));
            report.setScoreAccessibility(intOrZero(request.getScores().getAccessibility()));
            report.setScoreEfficiency(intOrZero(request.getScores().getEfficiency()));
            report.setScorePerformance(intOrZero(request.getScores().getPerformance()));
            report.setScoreBestPractices(intOrZero(request.getScores().getBestPractices()));
            report.setOverallScore(intOrZero(request.getScores().getOverall()));
        }

        if (request.getEvaluationVersion() != null && !request.getEvaluationVersion().isBlank()) {
            report.setEvaluationVersion(request.getEvaluationVersion());
        } else if (report.getEvaluationVersion() == null || report.getEvaluationVersion().isBlank()) {
            report.setEvaluationVersion("v1");
        }

        if (request.getScoreBreakdown() != null) {
            try {
                report.setScoreBreakdown(objectMapper.writeValueAsString(request.getScoreBreakdown()));
            } catch (Exception e) {
                log.warn("scoreBreakdown 저장 실패", e);
            }
        }

        if (request.getDeviceInfo() != null) {
            try {
                report.setDeviceInfo(objectMapper.writeValueAsString(request.getDeviceInfo()));
            } catch (Exception e) {
                log.warn("deviceInfo 저장 실패", e);
            }
        }

        if (request.getSteps() != null && !request.getSteps().isEmpty()) {
            try {
                List<Map<String, Object>> logs = new java.util.ArrayList<>();
                if (report.getRawLogs() != null && !report.getRawLogs().isBlank()) {
                    logs = objectMapper.readValue(report.getRawLogs(), new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
                }

                java.util.Set<String> existingStepKeys = new java.util.HashSet<>();
                for (Map<String, Object> logEntry : logs) {
                    existingStepKeys.add(stepKey(logEntry));
                }

                for (Map<String, Object> submittedStep : request.getSteps()) {
                    String key = stepKey(submittedStep);
                    if (!existingStepKeys.contains(key)) {
                        logs.add(submittedStep);
                        existingStepKeys.add(key);
                    }
                }

                report.setRawLogs(objectMapper.writeValueAsString(logs));
            } catch (Exception e) {
                log.warn("리포트에 포함된 steps를 rawLogs에 병합하지 못했습니다.", e);
            }
        }

        UIUXTestReportRepository.save(report);

        // Delete existing defects if any and save new ones
        uiuxTestDefectRepository.deleteByTestRequestId(requestId);
        if (request.getDefects() != null && !request.getDefects().isEmpty()) {
            List<UIUXTestDefect> defectsToSave = request.getDefects().stream().map(dto -> UIUXTestDefect.builder()
                    .testRequest(testRequest)
                    .category(dto.getCategory())
                    .selector(dto.getSelector())
                    .severity(dto.getSeverity())
                    .description(dto.getDescription())
                    .timestampOffset(dto.getTimestampOffset())
                    .source(dto.getSource())
                    .ruleId(dto.getRuleId())
                    .evidence(writeJsonOrNull(dto.getEvidence(), "defect evidence"))
                    .recommendation(dto.getRecommendation())
                    .screenshotUrl(dto.getScreenshotUrl())
                    .build()).toList();
            uiuxTestDefectRepository.saveAll(defectsToSave);
        }

        // 테스트 완료 상태로 변경
        if (!"FAILED".equals(testRequest.getTestStatus())) {
            testRequest.changeStatus("COMPLETED");
            testRequest.changePhase("FINISHED");
            testRequest.changeProgress(100);
        }
        testRequestRepository.save(testRequest);
        log.info("UI/UX 테스트 요청 {}의 최종 데이터 저장을 완료했습니다.", requestId);
    }

    @Transactional
    public void addStep(UUID requestId, Map<String, Object> request) {
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 테스트 요청입니다."));

        UIUXTestReport report = UIUXTestReportRepository.findByTestRequestId(requestId).orElseGet(() ->
                UIUXTestReportRepository.save(UIUXTestReport.builder()
                        .testRequest(testRequest)
                        .scoreUsability(0)
                        .scoreAccessibility(0)
                        .scoreEfficiency(0)
                        .scorePerformance(0)
                        .scoreBestPractices(0)
                        .overallScore(0)
                        .evaluationVersion("v1")
                        .rawLogs("[]")
                        .uiuxTestReview("")
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
        } catch (Exception e) {
            log.error("rawLogs 저장 실패", e);
        }

        UIUXTestReportRepository.save(report);

        // 첫 스텝이 접수되면 상태를 PENDING에서 RUNNING으로 갱신
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
            throw new IllegalArgumentException("해당 요청은 UI/UX 테스트 요청이 아닙니다.");
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
                    .scoreUsability(0)
                    .scoreAccessibility(0)
                    .scoreEfficiency(0)
                    .scorePerformance(0)
                    .scoreBestPractices(0)
                    .overallScore(0)
                    .evaluationVersion("v1")
                    .rawLogs("[]")
                    .uiuxTestReview("")
                    .build();
        }

        // 실패 상태에서도 기존 리포트 데이터는 유지합니다.
        UIUXTestReport failedReport = UIUXTestReport.builder()
                .id(report.getId())
                .testRequest(testRequest)
                .scoreUsability(report.getScoreUsability() != null ? report.getScoreUsability() : 0)
                .scoreAccessibility(report.getScoreAccessibility() != null ? report.getScoreAccessibility() : 0)
                .scoreEfficiency(report.getScoreEfficiency() != null ? report.getScoreEfficiency() : 0)
                .scorePerformance(report.getScorePerformance() != null ? report.getScorePerformance() : 0)
                .scoreBestPractices(report.getScoreBestPractices() != null ? report.getScoreBestPractices() : 0)
                .overallScore(report.getOverallScore() != null ? report.getOverallScore() : 0)
                .scoreBreakdown(report.getScoreBreakdown())
                .evaluationVersion(report.getEvaluationVersion() != null ? report.getEvaluationVersion() : "v1")
                .rawLogs(report.getRawLogs())
                .uiuxTestReview(report.getUiuxTestReview() != null ? report.getUiuxTestReview() : "")
                .build();
        UIUXTestReportRepository.save(failedReport);
        log.info("UI/UX 테스트 요청 {}을 FAILED로 표시했습니다. 사유: {}", requestId, reason);
    }

    private String stepKey(Map<String, Object> step) {
        return String.valueOf(step.get("step")) + ":" + String.valueOf(step.get("action"));
    }

    private String writeJsonOrNull(Object value, String label) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("{} 직렬화 실패", label, e);
            return null;
        }
    }

    private Integer intOrZero(Integer value) {
        return value != null ? value : 0;
    }

    @Transactional(readOnly = true)
    public URI getLiveVncBaseUri(UUID requestId) {
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 테스트 요청입니다."));

        if (!TEST_TYPE_UIUX.equals(testRequest.getTestType())) {
            throw new IllegalArgumentException("UI/UX 테스트 요청이 아닙니다.");
        }

        UIUXTestReport report = UIUXTestReportRepository.findByTestRequestId(requestId)
                .orElseThrow(() -> new IllegalStateException("아직 VNC 스트림이 준비되지 않았습니다."));

        List<Map<String, Object>> logs;
        try {
            logs = objectMapper.readValue(report.getRawLogs(), new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            throw new IllegalStateException("VNC 스트림 로그를 읽을 수 없습니다.", e);
        }

        for (int i = logs.size() - 1; i >= 0; i--) {
            Object rawVncUrl = logs.get(i).get("vncUrl");
            if (rawVncUrl instanceof String vncUrl && !vncUrl.isBlank()) {
                return validateVncBaseUri(vncUrl);
            }
        }

        throw new IllegalStateException("아직 VNC 스트림 URL이 준비되지 않았습니다.");
    }

    private URI validateVncBaseUri(String rawVncUrl) {
        URI uri = URI.create(rawVncUrl);
        String scheme = uri.getScheme();
        String host = uri.getHost();
        int port = uri.getPort();

        boolean isLocalLoopback = "127.0.0.1".equals(host) || "localhost".equalsIgnoreCase(host);
        boolean isAllowedPort = port == 6080 || (isLocalLoopback && port > 0);

        if (!"http".equalsIgnoreCase(scheme) || host == null || !isAllowedPort) {
            throw new IllegalStateException("허용되지 않는 VNC 스트림 URL입니다.");
        }

        return URI.create("http://" + host + ":" + port);
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
