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
                .findByUserAndRemainingChancesGreaterThan(user, 0);

        if (!availableCoupons.isEmpty()) {
            // 쿠폰 사용
            UserCoupon couponToUse = availableCoupons.getFirst();
            couponToUse.useChance();

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

        // FastAPI 호출 위임
        eventPublisher.publishEvent(new LoadTestSubmittedEvent(generatedRequestId, request));

        return generatedRequestId;
    }

    @Transactional(readOnly = true)
    public LoadTestResponse getTestResult(UUID requestId) {
        TestRequest testRequest = testRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Invalid request ID"));

        // 1. 아직 테스트가 도는 중(PENDING)이거나 실패(FAILED)한 경우
        if (!"COMPLETED".equals(testRequest.getTestStatus())) {
            // 프론트엔드가 상태를 알 수 있게 껍데기만 내려주거나
            // 202 Accepted 등의 상태로 처리할 수 있도록 응답 구성
            return LoadTestResponse.builder()
                    // status 필드가 DTO에 있다면 넣어주면 좋습니다.
                    .build();
        }

        // 2. 테스트가 완료된 경우 DB에서 리포트 조회
        LoadTestReport report = loadTestReportRepository.findByTestRequestId(requestId)
                .orElseThrow(() -> new IllegalStateException("Report should exist for COMPLETED request"));

        // 3. JSONB에서 차트 데이터 복구
        // (Jackson이 Map<String, Object>로 역직렬화 해준 데이터를 다시 DTO 리스트로 변환)
        // 참고: ObjectMapper를 사용하거나, 엔티티에서 처음부터 DTO 매핑을 사용하셨다면 생략 가능
        Object pointsObj = report.getRawMetrics().get("points");
        List<LoadTestResponse.ChartPoint> chartPoints = objectMapper.convertValue(
                pointsObj,
                new TypeReference<List<LoadTestResponse.ChartPoint>>() {}
        );

        // 4. 프론트로 내보낼 최종 객체 조립
        LoadTestResponse.TestResults resultsDto = LoadTestResponse.TestResults.builder()
                .maxTps(report.getTotalTps().intValue())
                .avgResponse(report.getAvgLatency() / 1000.0) // 다시 초 단위로 변환 예시
                .errorRate(report.getErrorRate().doubleValue())
                .bottleneckDiagnosis(report.getAiPerformanceReview())
                .points(chartPoints)
                .build();

        return LoadTestResponse.builder()
                .testResults(resultsDto)
                .build();
    }
}
