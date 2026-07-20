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

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.InetAddress;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class UIUXTestService {

    // UI/UX 테스트의 중심 서비스입니다.
    // 시작 요청 검증, 과금, 진행 로그 저장, 최종 리포트 저장, 상태 조회, VNC signed URL 발급까지
    // UI 테스트 생명주기에서 DB와 보안 판단이 필요한 작업을 담당합니다.
    private final UserRepository userRepository;
    private final UserCouponRepository userCouponRepository;
    private final CreditsLedgerRepository creditsLedgerRepository;
    private final TestRequestRepository testRequestRepository;
    private final RegisteredSiteRepository registeredSiteRepository;
    private final UIUXTestReportRepository UIUXTestReportRepository;
    private final UIUXTestDefectRepository uiuxTestDefectRepository;
    private final RestClient restClient;
    private final CouponUsageLogRepository couponUsageLogRepository;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;
    private final Map<UUID, URI> liveVncBaseUriCache = new ConcurrentHashMap<>();

    @Value("${supabase.url:}")
    private String supabaseUrl;

    @Value("${supabase.anon-key:}")
    private String supabaseAnonKey;

    @Value("${vnc.signed-url.secret:${SUPABASE_JWT_KEY:}}")
    private String vncSignedUrlSecret;

    @Value("${vnc.signed-url.ttl-seconds:300}")
    private long vncSignedUrlTtlSeconds;

    @Value("${vnc.readiness.connect-timeout-ms:${VNC_READINESS_CONNECT_TIMEOUT_MS:5000}}")
    private long vncReadinessConnectTimeoutMs;

    @Value("${vnc.readiness.request-timeout-ms:${VNC_READINESS_REQUEST_TIMEOUT_MS:7000}}")
    private long vncReadinessRequestTimeoutMs;

    private static final int TEST_COST = 1_000;
    private static final String TEST_TYPE_UIUX = "UIUX";
    private static final List<String> ACTIVE_TEST_STATUSES = List.of("PENDING", "RUNNING");
    private static final Duration STALE_ACTIVE_TEST_TIMEOUT = Duration.ofMinutes(15);

    private void failStaleActiveUIUXTests() {
        // 테스트가 비정상 종료되어 PENDING/RUNNING 상태로 남으면 같은 사용자가 새 테스트를 시작할 수 없습니다.
        // 새 요청을 접수하기 전에 오래된 활성 요청을 정리해 "계속 진행 중" 상태를 막습니다.
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
        // 사용자 요청을 실제 실행 가능한 테스트 주문으로 바꾸는 단계입니다.
        // 여기서 동시 실행 제한, 최근 결과 보관 개수, 쿠폰/크레딧 차감까지 한 트랜잭션 안에서 처리합니다.
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));
        validateTargetUrlBelongsToVerifiedSite(userId, request.getTargetUrl());

        failStaleActiveUIUXTests();

        boolean hasActiveTest = testRequestRepository.existsByUserAndTestTypeAndTestStatusIn(
                user, TEST_TYPE_UIUX, ACTIVE_TEST_STATUSES);
        if (hasActiveTest) {
            throw new IllegalStateException("이미 진행 중인 UI/UX 테스트가 있습니다. 완료 후 다시 시도해 주세요.");
        }

        List<TestRequest> userUiRequests = testRequestRepository.findByUserAndTestTypeOrderByCreatedAtAsc(user, TEST_TYPE_UIUX);
        if (userUiRequests.size() >= 10) {
            // 사용자별 UI/UX 결과 보관 개수를 10개로 제한합니다.
            // 오래된 요청을 삭제하기 전에 Supabase에 남은 녹화 영상도 같이 정리해 저장소가 누적되지 않게 합니다.
            int deleteCount = userUiRequests.size() - 9;
            for (int i = 0; i < deleteCount; i++) {
                TestRequest oldestRequest = userUiRequests.get(i);

                deleteVideoFromSupabase(oldestRequest.getId());

                testRequestRepository.delete(oldestRequest);
                log.info("10개 테스트 제한으로 인해 사용자 {}의 가장 오래된 UI/UX 테스트 요청 기록 {}을 삭제했습니다.", userId, oldestRequest.getId());
            }
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

        chargeForUIUXTest(user, savedRequest, request.getTargetUrl());

        // DB 커밋 이후 AsyncUIUXTestWorker가 이벤트를 받아 FastAPI로 전달합니다.
        // 커밋 전에 워커를 호출하지 않아 FastAPI가 아직 저장되지 않은 requestId를 참조하는 상황을 막습니다.
        eventPublisher.publishEvent(new UIUXTestSubmittedEvent(requestId, request));
        return requestId;
    }

    private void chargeForUIUXTest(User user, TestRequest testRequest, String targetUrl) {
        List<UserCoupon> availableCoupons = userCouponRepository
                .findAvailableForUpdate(user, CouponType.UIUX_TEST, 0);

        if (!availableCoupons.isEmpty()) {
            UserCoupon couponToUse = availableCoupons.getFirst();
            couponToUse.useChance();

            couponUsageLogRepository.save(CouponUsageLog.builder()
                    .user(user)
                    .testRequest(testRequest)
                    .userCoupon(couponToUse)
                    .couponType(CouponType.UIUX_TEST)
                    .action(CouponUsageAction.USE)
                    .description("UI/UX 테스트 실행 (" + targetUrl + ")")
                    .build());
            return;
        }

        if (user.getBalance() < TEST_COST) {
            throw new IllegalStateException("UI/UX 테스트 쿠폰 또는 크레딧 잔액이 부족합니다.");
        }

        user.deductBalance(TEST_COST);
        userRepository.save(user);

        CreditsLedger ledger = CreditsLedger.builder()
                .user(user)
                .testRequest(testRequest)
                .amount(-TEST_COST)
                .transactionType(CreditTransactionType.TEST_CONSUME)
                .description("AI UI/UX Test Execution")
                .build();
        creditsLedgerRepository.save(ledger);
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

    private void validateTargetUrlBelongsToVerifiedSite(UUID userId, String targetUrl) {
        URI targetUri = parseHttpUri(targetUrl, "테스트 대상 URL이 올바르지 않습니다.");
        validatePublicTargetUri(targetUri);
        String targetHost = normalizeHost(targetUri.getHost());
        if (targetHost == null || targetHost.isBlank()) {
            throw new IllegalArgumentException("테스트 대상 URL의 호스트를 확인할 수 없습니다.");
        }

        boolean matchesVerifiedSite = registeredSiteRepository.findByUser_UserIdAndIsVerifiedTrue(userId).stream()
                .map(RegisteredSite::getDomainUrl)
                .map(url -> parseHttpUri(url, null))
                .filter(uri -> uri != null && uri.getHost() != null)
                .map(uri -> normalizeHost(uri.getHost()))
                .anyMatch(verifiedHost -> targetHost.equals(verifiedHost));

        if (!matchesVerifiedSite) {
            throw new IllegalArgumentException("소유권 검증이 완료된 도메인만 UI/UX 테스트 대상으로 사용할 수 있습니다.");
        }
    }

    private URI parseHttpUri(String rawUrl, String errorMessage) {
        try {
            URI uri = new URI(rawUrl == null ? "" : rawUrl.trim());
            String scheme = uri.getScheme();
            if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
                throw new URISyntaxException(rawUrl == null ? "" : rawUrl, "unsupported scheme");
            }
            return uri;
        } catch (Exception e) {
            if (errorMessage == null) {
                return null;
            }
            throw new IllegalArgumentException(errorMessage);
        }
    }

    private String normalizeHost(String host) {
        if (host == null) {
            return null;
        }
        String lower = host.toLowerCase();
        return lower.startsWith("www.") ? lower.substring(4) : lower;
    }

    private void validatePublicTargetUri(URI uri) {
        String host = uri.getHost();
        int port = uri.getPort();
        if (host == null || host.isBlank() || uri.getUserInfo() != null) {
            throw new IllegalArgumentException("테스트 대상 URL의 호스트를 확인할 수 없습니다.");
        }
        if (port != -1 && port != 80 && port != 443) {
            throw new IllegalArgumentException("UI/UX 테스트는 80 또는 443 포트의 공개 URL만 지원합니다.");
        }
        String lowerHost = host.toLowerCase();
        if ("localhost".equals(lowerHost) || lowerHost.endsWith(".localhost")) {
            throw new IllegalArgumentException("localhost 주소는 UI/UX 테스트 대상으로 사용할 수 없습니다.");
        }
        try {
            for (InetAddress address : InetAddress.getAllByName(host)) {
                if (!isPublicAddress(address)) {
                    throw new IllegalArgumentException("사설망 또는 로컬 주소는 UI/UX 테스트 대상으로 사용할 수 없습니다.");
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("테스트 대상 URL의 DNS 정보를 확인할 수 없습니다.");
        }
    }

    private boolean isPublicAddress(InetAddress address) {
        if (address.isAnyLocalAddress()
                || address.isLoopbackAddress()
                || address.isLinkLocalAddress()
                || address.isSiteLocalAddress()
                || address.isMulticastAddress()) {
            return false;
        }

        byte[] bytes = address.getAddress();
        if (bytes.length == 4) {
            int first = bytes[0] & 0xff;
            int second = bytes[1] & 0xff;
            return first != 0
                    && first != 10
                    && first != 127
                    && !(first == 100 && second >= 64 && second <= 127)
                    && !(first == 169 && second == 254)
                    && !(first == 172 && second >= 16 && second <= 31)
                    && !(first == 192 && second == 168);
        }
        return bytes.length != 16 || ((bytes[0] & 0xfe) != 0xfc);
    }

    @Transactional(readOnly = true)
    public UIUXTestStatusResponse getTestStatusForUser(UUID userId, UUID requestId) {
        TestRequest testRequest = testRequestRepository.findByIdAndUser_UserIdAndTestType(requestId, userId, TEST_TYPE_UIUX)
                .orElseThrow(() -> new IllegalArgumentException("UI/UX 테스트 결과를 찾을 수 없습니다."));

        return buildTestStatus(testRequest);
    }

    private UIUXTestStatusResponse buildTestStatus(TestRequest testRequest) {
        // 프론트 polling 응답을 조립합니다.
        // 최신 리포트 projection, rawLogs, 점수, 결함, VNC 스트림 상태를 하나의 DTO로 묶어 반환합니다.
        UUID requestId = testRequest.getId();
        String reportMarkdown = "";
        List<Map<String, Object>> stepsList = new java.util.ArrayList<>();
        String videoUrl = null;
        Map<String, Object> deviceInfo = null;
        UIUXTestStatusResponse.ScoresDto scores = null;
        Map<String, Object> scoreBreakdown = null;
        String evaluationVersion = null;
        List<UIUXTestStatusResponse.DefectDto> defectDtos = new java.util.ArrayList<>();
        UIUXTestStatusResponse.LiveStreamDto liveStream = buildLiveStreamStatus(testRequest.getTestStatus(), stepsList);
        
        var reportOpt = UIUXTestReportRepository.findStatusProjectionByTestRequestId(requestId);
        if (reportOpt.isPresent()) {
            var report = reportOpt.get();
            reportMarkdown = report.getUiuxTestReview() != null ? report.getUiuxTestReview() : "";
            try {
                stepsList = objectMapper.readValue(report.getRawLogs(), new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
                liveStream = buildLiveStreamStatus(testRequest.getTestStatus(), stepsList);
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
            
            var defects = uiuxTestDefectRepository.findStatusProjectionsByTestRequestId(requestId);
            for (var defect : defects) {
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
                .liveStream(liveStream)
                .defects(defectDtos)
                .build();
    }

    private UIUXTestStatusResponse.LiveStreamDto buildLiveStreamStatus(String testStatus, List<Map<String, Object>> stepsList) {
        // liveStream은 VNC URL 존재 여부와 테스트 상태를 조합해 WAITING/READY/ENDED/FAILED로 표현합니다.
        // 실제 접속 가능한 signed URL은 보안 때문에 여기서 주지 않고 /vnc-token에서 별도로 발급합니다.
        URI baseUri = findLatestVncBaseUri(stepsList);
        if (baseUri != null) {
            boolean active = "PENDING".equals(testStatus) || "RUNNING".equals(testStatus);
            return UIUXTestStatusResponse.LiveStreamDto.builder()
                    .status(active ? "READY" : "ENDED")
                    .enabled(active)
                    .message(active ? "VNC 스트림 URL이 준비되었습니다." : "VNC 스트림이 종료되었습니다.")
                    .vncHost(baseUri.getHost())
                    .vncPort(baseUri.getPort())
                    .build();
        }

        if ("FAILED".equals(testStatus)) {
            return UIUXTestStatusResponse.LiveStreamDto.builder()
                    .status("FAILED")
                    .enabled(false)
                    .message("테스트 실패 전 VNC 스트림을 사용할 수 없었습니다.")
                    .build();
        }

        if ("COMPLETED".equals(testStatus)) {
            return UIUXTestStatusResponse.LiveStreamDto.builder()
                    .status("ENDED")
                    .enabled(false)
                    .message("테스트 완료 후 실시간 스트림이 종료되었습니다.")
                    .build();
        }

        return UIUXTestStatusResponse.LiveStreamDto.builder()
                .status("WAITING")
                .enabled(false)
                .message("브라우저 컨테이너의 VNC 스트림 URL을 기다리는 중입니다.")
                .build();
    }

    private URI findLatestVncBaseUri(List<Map<String, Object>> stepsList) {
        // 워커가 남긴 step 로그 중 가장 마지막 vncUrl을 찾습니다.
        // STARTING_VNC가 여러 번 들어올 수 있으므로 뒤에서부터 검색합니다.
        for (int i = stepsList.size() - 1; i >= 0; i--) {
            Object rawVncUrl = stepsList.get(i).get("vncUrl");
            if (rawVncUrl instanceof String vncUrl && !vncUrl.isBlank()) {
                try {
                    return validateVncBaseUri(vncUrl);
                } catch (Exception e) {
                    log.warn("VNC_DIAG status_vnc_url_invalid rawUrl={}", vncUrl, e);
                    return null;
                }
            }
        }
        return null;
    }


    @Transactional
    public void saveReport(UUID requestId, UIUXTestReportSubmitRequest request) {
        // Python 워커가 보내는 최종 결과 저장 지점입니다.
        // raw JSON 형태의 scoreBreakdown/deviceInfo/steps를 DB jsonb 문자열로 보관하고,
        // 프론트가 자주 읽는 점수/결함은 별도 컬럼/테이블로 분리합니다.
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 테스트 요청입니다."));

        if (!"UIUX".equals(testRequest.getTestType())) {
            throw new IllegalArgumentException("해당 요청은 UI/UX 테스트 요청이 아닙니다.");
        }

        var reportOpt = UIUXTestReportRepository.findFirstByTestRequestIdOrderByCreatedAtDescIdDesc(requestId);
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
                // 진행 중에 이미 저장된 step과 최종 report에 포함된 step을 병합합니다.
                // step/action 기준 중복 제거를 해 같은 단계가 최종 저장에서 두 번 보이지 않게 합니다.
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
                log.warn("리포트에 포함된 steps를 rawLogs와 병합하지 못했습니다.", e);
            }
        }

        UIUXTestReportRepository.save(report);

        // 워커가 최종 제출한 결함 목록을 진실의 원천으로 봅니다.
        // 기존 결함을 지우고 다시 저장해 재시도/중복 콜백 상황에서도 화면과 DB가 같은 상태가 되게 합니다.
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
        // 워커가 진행 상황을 실시간으로 보내는 콜백입니다.
        // 아직 최종 리포트가 없어도 rawLogs를 담을 빈 UIUXTestReport를 만들어 프론트 polling이 바로 읽을 수 있게 합니다.
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 테스트 요청입니다."));

        if ("COMPLETED".equals(testRequest.getTestStatus()) || "FAILED".equals(testRequest.getTestStatus())) {
            log.debug("Ignoring UI/UX step callback for terminal request {} with status {}", requestId, testRequest.getTestStatus());
            return;
        }

        UIUXTestReport report = UIUXTestReportRepository.findFirstByTestRequestIdOrderByCreatedAtDescIdDesc(requestId).orElseGet(() ->
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

        String submittedStepKey = stepKey(request);
        boolean alreadyRecorded = logs.stream()
                .map(this::stepKey)
                .anyMatch(submittedStepKey::equals);
        if (alreadyRecorded) {
            log.debug("Ignoring duplicate UI/UX step callback for request {} step {}", requestId, submittedStepKey);
            return;
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
        // 테스트 전체 실패 처리입니다.
        // 이미 저장된 rawLogs라도 점수/리포트가 있으면 보존해 사용자가 어디까지 진행됐는지 확인할 수 있게 합니다.
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 테스트 요청입니다."));

        if (!"UIUX".equals(testRequest.getTestType())) {
            throw new IllegalArgumentException("해당 요청은 UI/UX 테스트 요청이 아닙니다.");
        }

        if ("COMPLETED".equals(testRequest.getTestStatus())) {
            log.warn("이미 완료된 UI/UX 테스트 요청 {}의 실패 콜백을 무시합니다. 사유: {}", requestId, reason);
            return;
        }

        refundUIUXTestChargeIfNeeded(testRequest, reason);

        testRequest.changeStatus("FAILED");
        testRequest.changePhase("FAILED");
        testRequestRepository.save(testRequest);

        var reportOpt = UIUXTestReportRepository.findFirstByTestRequestIdOrderByCreatedAtDescIdDesc(requestId);
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

    private void refundUIUXTestChargeIfNeeded(TestRequest testRequest, String reason) {
        UUID requestId = testRequest.getId();
        if (creditsLedgerRepository.existsByTestRequest_IdAndTransactionType(requestId, CreditTransactionType.TEST_REFUND)
                || couponUsageLogRepository.existsByTestRequest_IdAndCouponTypeAndAction(
                requestId, CouponType.UIUX_TEST, CouponUsageAction.REFUND)) {
            log.info("UI/UX 테스트 요청 {}은 이미 환불 처리되어 추가 환불을 건너뜁니다.", requestId);
            return;
        }


        List<CouponUsageLog> couponUses = couponUsageLogRepository
                .findByTestRequest_IdAndCouponTypeAndActionOrderByUsedAtDesc(
                        requestId, CouponType.UIUX_TEST, CouponUsageAction.USE);
        if (!couponUses.isEmpty()) {
            CouponUsageLog originalUse = couponUses.getFirst();
            UserCoupon usedCoupon = originalUse.getUserCoupon();
            if (usedCoupon == null) {
                log.warn("UI/UX request {} has coupon usage without userCoupon. Coupon refund skipped.", requestId);
                return;
            }

            UserCoupon lockedCoupon = userCouponRepository.findByIdForUpdate(usedCoupon.getId())
                    .orElseThrow(() -> new IllegalArgumentException("사용된 UI/UX 쿠폰을 찾을 수 없습니다."));
            lockedCoupon.refundChance();
            couponUsageLogRepository.save(CouponUsageLog.builder()
                    .user(testRequest.getUser())
                    .testRequest(testRequest)
                    .userCoupon(lockedCoupon)
                    .couponType(CouponType.UIUX_TEST)
                    .action(CouponUsageAction.REFUND)
                    .description("UI/UX 테스트 실패/중지 쿠폰 환불 (" + reason + ")")
                    .build());
            log.info("Refunded one UI/UX coupon chance for request {}", requestId);
            return;
        }

        List<CreditsLedger> consumedLedgers = creditsLedgerRepository
                .findByTestRequest_IdAndTransactionType(requestId, CreditTransactionType.TEST_CONSUME);
        if (consumedLedgers.isEmpty()) {
            log.info("UI/UX 테스트 요청 {}에 환불할 크레딧/쿠폰 사용 기록이 없습니다.", requestId);
            return;
        }

        int refundAmount = consumedLedgers.stream()
                .map(CreditsLedger::getAmount)
                .filter(amount -> amount != null && amount < 0)
                .mapToInt(amount -> -amount)
                .sum();
        if (refundAmount <= 0) {
            log.info("UI/UX 테스트 요청 {}의 크레딧 환불 금액이 0이라 건너뜁니다.", requestId);
            return;
        }

        User user = userRepository.findByIdForUpdate(testRequest.getUser().getUserId())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));
        user.chargeBalance(refundAmount);
        userRepository.save(user);

        creditsLedgerRepository.save(CreditsLedger.builder()
                .user(user)
                .testRequest(testRequest)
                .amount(refundAmount)
                .transactionType(CreditTransactionType.TEST_REFUND)
                .description("UI/UX 테스트 실패/중지 크레딧 환불 (" + reason + ")")
                .build());
        log.info("UI/UX 테스트 요청 {}의 크레딧 {}원을 환불했습니다.", requestId, refundAmount);
    }

    @Transactional
    public void cancelTestForUser(UUID userId, UUID requestId) {
        // 사용자가 프론트에서 "중지"를 누른 경우입니다.
        // 실제 Docker/Fargate 프로세스 종료까지 강제하지 않고, 서비스 상태를 FAILED로 바꿔 더 이상 진행 중으로 보이지 않게 합니다.
        TestRequest testRequest = testRequestRepository.findByIdAndUser_UserIdAndTestType(requestId, userId, TEST_TYPE_UIUX)
                .orElseThrow(() -> new IllegalArgumentException("UI/UX 테스트 요청을 찾을 수 없습니다."));

        if ("COMPLETED".equals(testRequest.getTestStatus())) {
            throw new IllegalStateException("이미 완료된 UI/UX 테스트는 중지할 수 없습니다.");
        }

        if ("FAILED".equals(testRequest.getTestStatus())) {
            return;
        }

        markAsFailed(requestId, "사용자가 테스트를 중지했습니다.");
    }

    private String stepKey(Map<String, Object> step) {
        // rawLogs 중복 제거용 키입니다. 같은 step 번호라도 STARTING_VNC/STARTING_BROWSER는 같은 시작 단계로 취급합니다.
        return String.valueOf(step.get("step")) + ":" + normalizeStepAction(step.get("action"));
    }

    private String normalizeStepAction(Object rawAction) {
        String action = String.valueOf(rawAction);
        if ("STARTING_VNC".equals(action) || "STARTING_BROWSER".equals(action)) {
            return "STARTING";
        }
        return action;
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
        // VNC asset/WebSocket 프록시가 실제 컨테이너 주소를 찾아야 하는 경로입니다.
        // rawLogs 파싱은 자주 호출될 수 있으므로 한 번 찾은 base URI를 requestId별로 메모리에 캐시합니다.
        URI cachedUri = liveVncBaseUriCache.get(requestId);
        if (cachedUri != null) {
            log.info("VNC_DIAG base_uri_cache_hit requestId={} baseUri={}", requestId, cachedUri);
            return cachedUri;
        }

        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 테스트 요청입니다."));

        if (!TEST_TYPE_UIUX.equals(testRequest.getTestType())) {
            throw new IllegalArgumentException("UI/UX 테스트 요청이 아닙니다.");
        }

        var report = UIUXTestReportRepository.findStatusProjectionByTestRequestId(requestId)
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
                URI baseUri = validateVncBaseUri(vncUrl);
                liveVncBaseUriCache.put(requestId, baseUri);
                log.info("VNC_DIAG base_uri_ready requestId={} baseUri={}", requestId, baseUri);
                return baseUri;
            }
        }

        throw new IllegalStateException("아직 VNC 스트림 URL이 준비되지 않았습니다.");
    }

    @Transactional(readOnly = true)
    public long issueVncAccessExpiresAt(UUID userId, UUID requestId) {
        // VNC 토큰 발급 전 권한과 readiness를 함께 확인합니다.
        // 준비되지 않은 경우 IllegalStateException을 던져 컨트롤러가 202 pending 응답을 주도록 합니다.
        testRequestRepository.findByIdAndUser_UserIdAndTestType(requestId, userId, TEST_TYPE_UIUX)
                .orElseThrow(() -> new IllegalArgumentException("UI/UX VNC 접근 권한이 없습니다."));

        URI baseUri = getLiveVncBaseUri(requestId);
        ensureLiveVncHttpReady(requestId, baseUri);
        return Instant.now().plusSeconds(vncSignedUrlTtlSeconds).getEpochSecond();
    }

    public String signVncAccess(UUID requestId, long expiresAt) {
        // requestId와 만료 시각을 HMAC으로 서명합니다.
        // 서버가 같은 secret으로 다시 계산해 비교하므로 DB에 토큰을 저장할 필요가 없습니다.
        if (vncSignedUrlSecret == null || vncSignedUrlSecret.isBlank()) {
            throw new IllegalStateException("VNC signed URL secret is not configured.");
        }

        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(vncSignedUrlSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] signature = mac.doFinal(vncTokenPayload(requestId, expiresAt).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(signature);
        } catch (Exception e) {
            throw new IllegalStateException("VNC signed URL token could not be created.", e);
        }
    }

    public void validateVncAccessToken(UUID requestId, long expiresAt, String token) {
        // noVNC HTML 진입과 WebSocket handshake 모두 이 검증을 통과해야 합니다.
        // MessageDigest.isEqual을 사용해 문자열 비교 시간 차이를 줄입니다.
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("VNC token is required.");
        }

        if (Instant.now().getEpochSecond() > expiresAt) {
            throw new IllegalArgumentException("VNC token has expired.");
        }

        String expectedToken = signVncAccess(requestId, expiresAt);
        boolean tokenMatches = MessageDigest.isEqual(
                expectedToken.getBytes(StandardCharsets.UTF_8),
                token.getBytes(StandardCharsets.UTF_8));

        if (!tokenMatches) {
            throw new IllegalArgumentException("Invalid VNC token.");
        }
    }

    private String vncTokenPayload(UUID requestId, long expiresAt) {
        return requestId + ":" + expiresAt;
    }

    private void ensureLiveVncHttpReady(UUID requestId, URI baseUri) {
        // step에 vncUrl이 기록되어도 noVNC HTTP 서버가 아직 뜨지 않았을 수 있습니다.
        // 토큰 발급 전에 /vnc.html을 한 번 호출해 실제 접속 준비가 끝났는지 확인합니다.
        URI healthUri = URI.create(baseUri + "/vnc.html");
        HttpClient readinessClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(vncReadinessConnectTimeoutMs))
                .build();
        HttpRequest request = HttpRequest.newBuilder(healthUri)
                .timeout(Duration.ofMillis(vncReadinessRequestTimeoutMs))
                .GET()
                .build();

        long startedAt = System.nanoTime();
        log.info("VNC_DIAG readiness_request requestId={} baseUri={} connectTimeoutMs={} requestTimeoutMs={}",
                requestId, baseUri, vncReadinessConnectTimeoutMs, vncReadinessRequestTimeoutMs);
        try {
            HttpResponse<Void> response = readinessClient.send(request, HttpResponse.BodyHandlers.discarding());
            int statusCode = response.statusCode();
            long elapsedMs = Duration.ofNanos(System.nanoTime() - startedAt).toMillis();
            if (statusCode >= 200 && statusCode < 400) {
                log.info("VNC_DIAG readiness_ready requestId={} status={} elapsedMs={}", requestId, statusCode, elapsedMs);
                return;
            }
            log.info("VNC_DIAG readiness_not_ready requestId={} status={} elapsedMs={}", requestId, statusCode, elapsedMs);
            throw new IllegalStateException("VNC stream is not ready. status=" + statusCode);
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            long elapsedMs = Duration.ofNanos(System.nanoTime() - startedAt).toMillis();
            log.info("VNC_DIAG readiness_error requestId={} baseUri={} elapsedMs={} error={}",
                    requestId, baseUri, elapsedMs, e.toString());
            throw new IllegalStateException("VNC stream is not ready.", e);
        }
    }

    private URI validateVncBaseUri(String rawVncUrl) {
        // 워커가 보낸 vncUrl을 프록시가 접근할 base URI로 정규화합니다.
        // SSRF 위험을 줄이기 위해 http scheme과 허용 포트만 통과시킵니다.
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
        // 보관 개수 제한으로 오래된 테스트 요청을 삭제할 때 Supabase Storage의 녹화 파일도 제거합니다.
        // 삭제 실패가 요청 생성 자체를 막을 정도로 치명적인 오류는 아니므로 로그만 남깁니다.
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
