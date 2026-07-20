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

    // UI/UX ?뚯뒪?몄쓽 以묒떖 ?쒕퉬?ㅼ엯?덈떎.
    // ?쒖옉 ?붿껌 寃利?怨쇨툑, 吏꾪뻾 濡쒓렇 ??? 理쒖쥌 由ы룷????? ?곹깭 議고쉶, VNC signed URL 諛쒓툒源뚯?
    // UI ?뚯뒪???앸챸二쇨린?먯꽌 DB? 蹂댁븞 ?먮떒???꾩슂???묒뾽???대떦?⑸땲??
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
        // ?뚯뒪?멸? 鍮꾩젙??醫낅즺?섏뼱 PENDING/RUNNING ?곹깭濡??⑥쑝硫?媛숈? ?ъ슜?먭? ???뚯뒪?몃? ?쒖옉?????놁뒿?덈떎.
        // ???붿껌???묒닔?섍린 ?꾩뿉 ?ㅻ옒???쒖꽦 ?붿껌???뺣━??"?곸썝??吏꾪뻾 以? ?곹깭瑜???댁쨳?덈떎.
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
        log.warn("{}媛쒖쓽 ?ㅻ옒??UI/UX ?뚯뒪???붿껌??{}遺?寃쎄낵濡??명빐 FAILED 泥섎━?덉뒿?덈떎.",
                staleRequests.size(),
                STALE_ACTIVE_TEST_TIMEOUT.toMinutes());
    }

    @Transactional
    public UUID submitUIUXTest(UUID userId, UIUXTestStartRequest request) {
        // ?ъ슜???붿껌???ㅼ젣 ?ㅽ뻾 媛?ν븳 ?뚯뒪??二쇰Ц?쒕줈 諛붽씀???④퀎?낅땲??
        // ?ш린???숈떆 ?ㅽ뻾 ?쒗븳, 理쒓렐 寃곌낵 蹂닿? 媛쒖닔, 荑좏룿/?щ젅??李④컧源뚯? ???몃옖??뀡 ?덉뿉??泥섎━?⑸땲??
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("議댁옱?섏? ?딅뒗 ?ъ슜?먯엯?덈떎."));
        validateTargetUrlBelongsToVerifiedSite(userId, request.getTargetUrl());

        failStaleActiveUIUXTests();

        boolean hasActiveTest = testRequestRepository.existsByUserAndTestTypeAndTestStatusIn(
                user, TEST_TYPE_UIUX, ACTIVE_TEST_STATUSES);
        if (hasActiveTest) {
            throw new IllegalStateException("?대? 吏꾪뻾 以묒씤 UI/UX ?뚯뒪?멸? ?덉뒿?덈떎. ?꾨즺 ???ㅼ떆 ?쒕룄??二쇱꽭??");
        }

        List<TestRequest> userUiRequests = testRequestRepository.findByUserAndTestTypeOrderByCreatedAtAsc(user, TEST_TYPE_UIUX);
        if (userUiRequests.size() >= 10) {
            // ?ъ슜?먮퀎 UI/UX 寃곌낵 蹂닿? 媛쒖닔瑜?10媛쒕줈 ?쒗븳?⑸땲??
            // ?ㅻ옒???붿껌????젣?섍린 ?꾩뿉 Supabase???⑥? ?뱁솕 ?곸긽??媛숈씠 ?뺣━????μ냼媛 ?꾩쟻?섏? ?딄쾶 ?⑸땲??
            int deleteCount = userUiRequests.size() - 9;
            for (int i = 0; i < deleteCount; i++) {
                TestRequest oldestRequest = userUiRequests.get(i);

                deleteVideoFromSupabase(oldestRequest.getId());

                testRequestRepository.delete(oldestRequest);
                log.info("10媛??뚯뒪???쒗븳?쇰줈 ?명빐 ?ъ슜??{}??媛???ㅻ옒??UI/UX ?뚯뒪???붿껌 湲곕줉 {}????젣?덉뒿?덈떎.", userId, oldestRequest.getId());
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

        // DB 而ㅻ컠 ?댄썑 AsyncUIUXTestWorker媛 ?대깽?몃? 諛쏆븘 FastAPI濡??꾨떖?⑸땲??
        // 而ㅻ컠 ?꾩뿉 ?몃? ?몄텧???섏? ?딆븘 FastAPI媛 ?꾩쭅 ??λ릺吏 ?딆? requestId瑜?李몄“?섎뒗 ?곹솴???쇳빀?덈떎.
        eventPublisher.publishEvent(new UIUXTestSubmittedEvent(requestId, request));
        return requestId;
    }

    private void chargeForUIUXTest(User user, TestRequest testRequest, String targetUrl) {
        List<UserCoupon> availableCoupons = userCouponRepository
                .findByUserAndCoupon_CouponTypeAndRemainingChancesGreaterThanOrderByCreatedAtAsc(user, CouponType.UIUX_TEST, 0);

        if (!availableCoupons.isEmpty()) {
            UserCoupon couponToUse = availableCoupons.getFirst();
            couponToUse.useChance();

            couponUsageLogRepository.save(CouponUsageLog.builder()
                    .user(user)
                    .testRequest(testRequest)
                    .userCoupon(couponToUse)
                    .couponType(CouponType.UIUX_TEST)
                    .action(CouponUsageAction.USE)
                    .description("UI/UX ?뚯뒪???ㅽ뻾 (" + targetUrl + ")")
                    .build());
            return;
        }

        if (user.getBalance() < TEST_COST) {
            throw new IllegalStateException("UI/UX ?뚯뒪??荑좏룿 ?먮뒗 ?щ젅???붿븸??遺議깊빀?덈떎.");
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
                .orElseThrow(() -> new IllegalArgumentException("議댁옱?섏? ?딅뒗 ?뚯뒪???붿껌?낅땲??"));

        if (!"UIUX".equals(testRequest.getTestType())) {
            throw new IllegalArgumentException("?대떦 ?붿껌? UI/UX ?뚯뒪???붿껌???꾨떃?덈떎.");
        }

        return buildTestStatus(testRequest);
    }

    private void validateTargetUrlBelongsToVerifiedSite(UUID userId, String targetUrl) {
        URI targetUri = parseHttpUri(targetUrl, "?뚯뒪?????URL???щ컮瑜댁? ?딆뒿?덈떎.");
        String targetHost = normalizeHost(targetUri.getHost());
        if (targetHost == null || targetHost.isBlank()) {
            throw new IllegalArgumentException("?뚯뒪?????URL???몄뒪?몃? ?뺤씤?????놁뒿?덈떎.");
        }

        boolean matchesVerifiedSite = registeredSiteRepository.findByUser_UserIdAndIsVerifiedTrue(userId).stream()
                .map(RegisteredSite::getDomainUrl)
                .map(url -> parseHttpUri(url, null))
                .filter(uri -> uri != null && uri.getHost() != null)
                .map(uri -> normalizeHost(uri.getHost()))
                .anyMatch(verifiedHost -> targetHost.equals(verifiedHost));

        if (!matchesVerifiedSite) {
            throw new IllegalArgumentException("?뚯쑀沅?寃利앹씠 ?꾨즺???꾨찓?몃쭔 UI/UX ?뚯뒪????곸쑝濡??ъ슜?????덉뒿?덈떎.");
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

    @Transactional(readOnly = true)
    public UIUXTestStatusResponse getTestStatusForUser(UUID userId, UUID requestId) {
        TestRequest testRequest = testRequestRepository.findByIdAndUser_UserIdAndTestType(requestId, userId, TEST_TYPE_UIUX)
                .orElseThrow(() -> new IllegalArgumentException("UI/UX ?뚯뒪??寃곌낵瑜?李얠쓣 ???놁뒿?덈떎."));

        return buildTestStatus(testRequest);
    }

    private UIUXTestStatusResponse buildTestStatus(TestRequest testRequest) {
        // ?꾨줎??polling ?묐떟??議곕┰?⑸땲??
        // 理쒖떊 由ы룷??projection, rawLogs, ?먯닔, 寃고븿, VNC ?ㅽ듃由??곹깭瑜??섎굹??DTO濡??⑹퀜 諛섑솚?⑸땲??
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
                log.warn("?뚯뒪???곹깭 議고쉶瑜??꾪븳 rawLogs ?뚯떛 ?ㅽ뙣", e);
            }
            videoUrl = report.getVideoUrl();
            try {
                if (report.getDeviceInfo() != null) {
                    deviceInfo = objectMapper.readValue(report.getDeviceInfo(), new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
                }
            } catch (Exception e) {
                log.warn("deviceInfo ?뚯떛 ?ㅽ뙣", e);
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
                log.warn("scoreBreakdown ?뚯떛 ?ㅽ뙣", e);
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
                    log.warn("defect evidence ?뚯떛 ?ㅽ뙣. defectId={}", defect.getId(), e);
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
        // liveStream? VNC URL 議댁옱 ?щ?? ?뚯뒪???곹깭瑜?議고빀??WAITING/READY/ENDED/FAILED濡??쒗쁽?⑸땲??
        // ?ㅼ젣 ?묒냽 媛?ν븳 signed URL? 蹂댁븞 ?뚮Ц???ш린??二쇱? ?딄퀬 /vnc-token?먯꽌 蹂꾨룄濡?諛쒓툒?⑸땲??
        URI baseUri = findLatestVncBaseUri(stepsList);
        if (baseUri != null) {
            boolean active = "PENDING".equals(testStatus) || "RUNNING".equals(testStatus);
            return UIUXTestStatusResponse.LiveStreamDto.builder()
                    .status(active ? "READY" : "ENDED")
                    .enabled(active)
                    .message(active ? "VNC stream URL is ready." : "VNC stream finished.")
                    .vncHost(baseUri.getHost())
                    .vncPort(baseUri.getPort())
                    .build();
        }

        if ("FAILED".equals(testStatus)) {
            return UIUXTestStatusResponse.LiveStreamDto.builder()
                    .status("FAILED")
                    .enabled(false)
                    .message("VNC stream did not become available before the test failed.")
                    .build();
        }

        if ("COMPLETED".equals(testStatus)) {
            return UIUXTestStatusResponse.LiveStreamDto.builder()
                    .status("ENDED")
                    .enabled(false)
                    .message("Live stream ended after test completion.")
                    .build();
        }

        return UIUXTestStatusResponse.LiveStreamDto.builder()
                .status("WAITING")
                .enabled(false)
                .message("Waiting for browser container to publish VNC stream URL.")
                .build();
    }

    private URI findLatestVncBaseUri(List<Map<String, Object>> stepsList) {
        // ?뚯빱媛 ?④릿 step 濡쒓렇 以?媛??留덉?留?vncUrl??李얠뒿?덈떎.
        // STARTING_VNC媛 ?щ윭 踰??ㅼ뼱?????덉쑝誘濡??ㅼ뿉?쒕???寃?됲빀?덈떎.
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
        // Python ?뚯빱媛 蹂대궡??理쒖쥌 寃곌낵 ???吏?먯엯?덈떎.
        // raw JSON ?뺥깭??scoreBreakdown/deviceInfo/steps??DB jsonb 臾몄옄?대줈 蹂닿??섍퀬,
        // ?꾨줎?멸? ?먯＜ ?곕뒗 ?먯닔/寃고븿? 蹂꾨룄 而щ읆/?뚯씠釉붾줈 遺꾨━?⑸땲??
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("議댁옱?섏? ?딅뒗 ?뚯뒪???붿껌?낅땲??"));

        if (!"UIUX".equals(testRequest.getTestType())) {
            throw new IllegalArgumentException("?대떦 ?붿껌? UI/UX ?뚯뒪???붿껌???꾨떃?덈떎.");
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
                log.warn("scoreBreakdown ????ㅽ뙣", e);
            }
        }

        if (request.getDeviceInfo() != null) {
            try {
                report.setDeviceInfo(objectMapper.writeValueAsString(request.getDeviceInfo()));
            } catch (Exception e) {
                log.warn("deviceInfo ????ㅽ뙣", e);
            }
        }

        if (request.getSteps() != null && !request.getSteps().isEmpty()) {
            try {
                // 吏꾪뻾 以묒뿉 ?대? ??λ맂 step怨?理쒖쥌 report???ы븿??step??蹂묓빀?⑸땲??
                // step/action 湲곗? 以묐났 ?쒓굅瑜???媛숈? ?④퀎媛 理쒖쥌 ???????踰?蹂댁씠吏 ?딄쾶 ?⑸땲??
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
                log.warn("由ы룷?몄뿉 ?ы븿??steps瑜?rawLogs??蹂묓빀?섏? 紐삵뻽?듬땲??", e);
            }
        }

        UIUXTestReportRepository.save(report);

        // ?뚯빱媛 理쒖쥌 ?곗텧??寃고븿 紐⑸줉??吏꾩떎???먯쿇?쇰줈 遊낅땲??
        // 湲곗〈 寃고븿??吏?곌퀬 ?ㅼ떆 ??ν빐 ?ъ떆??以묐났 肄쒕갚 ?곹솴?먯꽌???붾㈃怨?DB媛 媛숈? ?곹깭媛 ?섍쾶 ?⑸땲??
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

        // ?뚯뒪???꾨즺 ?곹깭濡?蹂寃?
        if (!"FAILED".equals(testRequest.getTestStatus())) {
            testRequest.changeStatus("COMPLETED");
            testRequest.changePhase("FINISHED");
            testRequest.changeProgress(100);
        }
        testRequestRepository.save(testRequest);
        log.info("UI/UX ?뚯뒪???붿껌 {}??理쒖쥌 ?곗씠????μ쓣 ?꾨즺?덉뒿?덈떎.", requestId);
    }

    @Transactional
    public void addStep(UUID requestId, Map<String, Object> request) {
        // ?뚯빱媛 吏꾪뻾 ?곹솴???ㅼ떆媛꾩쑝濡?蹂대궡??肄쒕갚?낅땲??
        // ?꾩쭅 理쒖쥌 由ы룷?멸? ?놁뼱??rawLogs瑜??댁쓣 鍮?UIUXTestReport瑜?留뚮뱾???꾨줎??polling??諛붾줈 ?쎌쓣 ???덇쾶 ?⑸땲??
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("議댁옱?섏? ?딅뒗 ?뚯뒪???붿껌?낅땲??"));

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
            log.error("rawLogs ????ㅽ뙣", e);
        }

        UIUXTestReportRepository.save(report);

        // 泥??ㅽ뀦???묒닔?섎㈃ ?곹깭瑜?PENDING?먯꽌 RUNNING?쇰줈 媛깆떊
        if ("PENDING".equals(testRequest.getTestStatus())) {
            testRequest.changeStatus("RUNNING");
            testRequest.changePhase("EXPLORING");
            testRequestRepository.save(testRequest);
        }
    }

    @Transactional
    public void markAsFailed(UUID requestId, String reason) {
        // ?뚯뒪???꾩껜 ?ㅽ뙣 泥섎━?낅땲??
        // ?대? ??λ맂 rawLogs???쇰? ?먯닔/由ы룷?멸? ?덉쑝硫?蹂댁〈???ъ슜?먭? ?대뵒源뚯? 吏꾪뻾?먮뒗吏 ?뺤씤?????덇쾶 ?⑸땲??
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("議댁옱?섏? ?딅뒗 ?뚯뒪???붿껌?낅땲??"));

        if (!"UIUX".equals(testRequest.getTestType())) {
            throw new IllegalArgumentException("?대떦 ?붿껌? UI/UX ?뚯뒪???붿껌???꾨떃?덈떎.");
        }

        if ("COMPLETED".equals(testRequest.getTestStatus())) {
            log.warn("?대? ?꾨즺??UI/UX ?뚯뒪???붿껌 {}???ㅽ뙣 肄쒕갚??臾댁떆?⑸땲?? ?ъ쑀: {}", requestId, reason);
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

        // ?ㅽ뙣 ?곹깭?먯꽌??湲곗〈 由ы룷???곗씠?곕뒗 ?좎??⑸땲??
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
        log.info("UI/UX ?뚯뒪???붿껌 {}??FAILED濡??쒖떆?덉뒿?덈떎. ?ъ쑀: {}", requestId, reason);
    }

    private void refundUIUXTestChargeIfNeeded(TestRequest testRequest, String reason) {
        UUID requestId = testRequest.getId();
        if (creditsLedgerRepository.existsByTestRequest_IdAndTransactionType(requestId, CreditTransactionType.TEST_REFUND)
                || couponUsageLogRepository.existsByTestRequest_IdAndCouponTypeAndAction(
                requestId, CouponType.UIUX_TEST, CouponUsageAction.REFUND)) {
            log.info("UI/UX ?뚯뒪???붿껌 {}? ?대? ?섎텋 泥섎━?섏뼱 異붽? ?섎텋??嫄대꼫?곷땲??", requestId);
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

            usedCoupon.refundChance();
            couponUsageLogRepository.save(CouponUsageLog.builder()
                    .user(testRequest.getUser())
                    .testRequest(testRequest)
                    .userCoupon(usedCoupon)
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
            log.info("UI/UX ?뚯뒪???붿껌 {}???섎텋???щ젅??荑좏룿 ?ъ슜 湲곕줉???놁뒿?덈떎.", requestId);
            return;
        }

        int refundAmount = consumedLedgers.stream()
                .map(CreditsLedger::getAmount)
                .filter(amount -> amount != null && amount < 0)
                .mapToInt(amount -> -amount)
                .sum();
        if (refundAmount <= 0) {
            log.info("UI/UX ?뚯뒪???붿껌 {}???щ젅???섎텋 湲덉븸??0?대씪 嫄대꼫?곷땲??", requestId);
            return;
        }

        User user = testRequest.getUser();
        user.chargeBalance(refundAmount);
        userRepository.save(user);

        creditsLedgerRepository.save(CreditsLedger.builder()
                .user(user)
                .testRequest(testRequest)
                .amount(refundAmount)
                .transactionType(CreditTransactionType.TEST_REFUND)
                .description("UI/UX 테스트 실패/중지 크레딧 환불 (" + reason + ")")
                .build());
        log.info("UI/UX ?뚯뒪???붿껌 {}???щ젅??{}?먯쓣 ?섎텋?덉뒿?덈떎.", requestId, refundAmount);
    }

    @Transactional
    public void cancelTestForUser(UUID userId, UUID requestId) {
        // ?ъ슜?먭? ?꾨줎?몄뿉??"以묒?"瑜??꾨Ⅸ 寃쎌슦?낅땲??
        // ?ㅼ젣 Docker/Fargate ?꾨줈?몄뒪 醫낅즺源뚯? 媛뺤젣?섏????딄퀬, ?쒕퉬???곹깭瑜?FAILED濡?諛붽퓭 ???댁긽 吏꾪뻾 以묒쑝濡?蹂댁씠吏 ?딄쾶 ?⑸땲??
        TestRequest testRequest = testRequestRepository.findByIdAndUser_UserIdAndTestType(requestId, userId, TEST_TYPE_UIUX)
                .orElseThrow(() -> new IllegalArgumentException("UI/UX ?뚯뒪???붿껌??李얠쓣 ???놁뒿?덈떎."));

        if ("COMPLETED".equals(testRequest.getTestStatus())) {
            throw new IllegalStateException("?대? ?꾨즺??UI/UX ?뚯뒪?몃뒗 以묒??????놁뒿?덈떎.");
        }

        if ("FAILED".equals(testRequest.getTestStatus())) {
            return;
        }

        markAsFailed(requestId, "?ъ슜?먭? ?뚯뒪?몃? 以묒??덉뒿?덈떎.");
    }

    private String stepKey(Map<String, Object> step) {
        // rawLogs 以묐났 ?쒓굅???ㅼ엯?덈떎. ?숈씪 step 踰덊샇?쇰룄 STARTING_VNC/STARTING_BROWSER??媛숈? ?쒖옉 ?④퀎濡?痍④툒?⑸땲??
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
            log.warn("{} 吏곷젹???ㅽ뙣", label, e);
            return null;
        }
    }

    private Integer intOrZero(Integer value) {
        return value != null ? value : 0;
    }

    @Transactional(readOnly = true)
    public URI getLiveVncBaseUri(UUID requestId) {
        // VNC asset/WebSocket ?꾨줉?쒓? ?ㅼ젣 而⑦뀒?대꼫 二쇱냼瑜??뚯븘?대뒗 寃쎈줈?낅땲??
        // rawLogs ?뚯떛? ?먯＜ ?몄텧?????덉쑝誘濡???踰?李얠? base URI??requestId蹂꾨줈 硫붾え由ъ뿉 罹먯떆?⑸땲??
        URI cachedUri = liveVncBaseUriCache.get(requestId);
        if (cachedUri != null) {
            log.info("VNC_DIAG base_uri_cache_hit requestId={} baseUri={}", requestId, cachedUri);
            return cachedUri;
        }

        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("議댁옱?섏? ?딅뒗 ?뚯뒪???붿껌?낅땲??"));

        if (!TEST_TYPE_UIUX.equals(testRequest.getTestType())) {
            throw new IllegalArgumentException("UI/UX ?뚯뒪???붿껌???꾨떃?덈떎.");
        }

        var report = UIUXTestReportRepository.findStatusProjectionByTestRequestId(requestId)
                .orElseThrow(() -> new IllegalStateException("?꾩쭅 VNC ?ㅽ듃由쇱씠 以鍮꾨릺吏 ?딆븯?듬땲??"));

        List<Map<String, Object>> logs;
        try {
            logs = objectMapper.readValue(report.getRawLogs(), new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            throw new IllegalStateException("VNC ?ㅽ듃由?濡쒓렇瑜??쎌쓣 ???놁뒿?덈떎.", e);
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

        throw new IllegalStateException("?꾩쭅 VNC ?ㅽ듃由?URL??以鍮꾨릺吏 ?딆븯?듬땲??");
    }

    @Transactional(readOnly = true)
    public long issueVncAccessExpiresAt(UUID userId, UUID requestId) {
        // VNC ?좏겙 諛쒓툒 ??沅뚰븳怨?readiness瑜??④퍡 ?뺤씤?⑸땲??
        // 以鍮꾨릺吏 ?딆? 寃쎌슦 IllegalStateException???섏졇 而⑦듃濡ㅻ윭媛 202 pending ?묐떟??二쇰룄濡??⑸땲??
        testRequestRepository.findByIdAndUser_UserIdAndTestType(requestId, userId, TEST_TYPE_UIUX)
                .orElseThrow(() -> new IllegalArgumentException("UI/UX VNC ?묎렐 沅뚰븳???놁뒿?덈떎."));

        URI baseUri = getLiveVncBaseUri(requestId);
        ensureLiveVncHttpReady(requestId, baseUri);
        return Instant.now().plusSeconds(vncSignedUrlTtlSeconds).getEpochSecond();
    }

    public String signVncAccess(UUID requestId, long expiresAt) {
        // requestId? 留뚮즺 ?쒓컖??HMAC?쇰줈 ?쒕챸?⑸땲??
        // ?쒕쾭媛 媛숈? secret?쇰줈 ?ㅼ떆 怨꾩궛??鍮꾧탳?섎?濡?DB???좏겙????ν븷 ?꾩슂媛 ?놁뒿?덈떎.
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
        // noVNC HTML 吏꾩엯?먭낵 WebSocket handshake 紐⑤몢 ??寃利앹쓣 ?듦낵?댁빞 ?⑸땲??
        // MessageDigest.isEqual???ъ슜??臾몄옄??鍮꾧탳 ?쒓컙 李⑥씠瑜?以꾩엯?덈떎.
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
        // step??vncUrl??湲곕줉?섏뼱??noVNC HTTP ?쒕쾭媛 ?꾩쭅 ?⑥? ?딆븯?????덉뒿?덈떎.
        // ?좏겙 諛쒓툒 ?꾩뿉 /vnc.html????踰??몄텧???ㅼ젣 ?묒냽 以鍮꾧? ?앸궗?붿? ?뺤씤?⑸땲??
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
        // ?뚯빱媛 蹂대궦 vncUrl???꾨줉?쒓? ?묎렐??base URI濡??뺢퇋?뷀빀?덈떎.
        // SSRF ?꾪뿕??以꾩씠湲??꾪빐 http scheme怨??덉슜 ?ы듃留??듦낵?쒗궢?덈떎.
        URI uri = URI.create(rawVncUrl);
        String scheme = uri.getScheme();
        String host = uri.getHost();
        int port = uri.getPort();

        boolean isLocalLoopback = "127.0.0.1".equals(host) || "localhost".equalsIgnoreCase(host);
        boolean isAllowedPort = port == 6080 || (isLocalLoopback && port > 0);

        if (!"http".equalsIgnoreCase(scheme) || host == null || !isAllowedPort) {
            throw new IllegalStateException("?덉슜?섏? ?딅뒗 VNC ?ㅽ듃由?URL?낅땲??");
        }

        return URI.create("http://" + host + ":" + port);
    }

    private void deleteVideoFromSupabase(UUID requestId) {
        // 蹂닿? 媛쒖닔 ?쒗븳?쇰줈 ?ㅻ옒???뚯뒪???붿껌????젣????Supabase Storage???뱁솕 ?뚯씪???쒓굅?⑸땲??
        // ??젣 ?ㅽ뙣???붿껌 ?앹꽦 ?먯껜瑜?留됱쓣 ?뺣룄??移섎챸 ?ㅻ쪟???꾨땲誘濡?濡쒓렇留??④퉩?덈떎.
        if (supabaseUrl == null || supabaseUrl.trim().isEmpty() ||
                supabaseAnonKey == null || supabaseAnonKey.trim().isEmpty()) {
            log.warn("Supabase ?몄쬆 ?뺣낫媛 ?꾩쟾??援ъ꽦?섏? ?딆븯?듬땲?? 鍮꾨뵒????젣瑜?嫄대꼫?곷땲??");
            return;
        }

        String bucketName = "ui-test-videos";
        String path = requestId.toString() + ".webm";
        String url = supabaseUrl + "/storage/v1/object/" + bucketName + "/" + path;

        try {
            log.info("Supabase ?ㅽ넗由ъ??먯꽌 鍮꾨뵒????젣 ?쒕룄 以? {}", url);
            restClient.delete()
                    .uri(url)
                    .header("Authorization", "Bearer " + supabaseAnonKey)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Supabase ?ㅽ넗由ъ??먯꽌 鍮꾨뵒???뚯씪 {} ??젣 ?깃났", path);
        } catch (Exception e) {
            log.error("Supabase ?ㅽ넗由ъ??먯꽌 鍮꾨뵒???뚯씪 {} ??젣 ?ㅽ뙣 (議댁옱?섏? ?딆쓣 ???덉쓬)", path, e);
        }
    }
}
