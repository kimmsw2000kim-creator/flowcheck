package com.flowcheck.service;

import com.flowcheck.domain.CreditsLedger;
import com.flowcheck.domain.TestRequest;
import com.flowcheck.domain.User;
import com.flowcheck.domain.UserCoupon;
import com.flowcheck.dto.LoadTest.LoadTestRequest;
import com.flowcheck.dto.LoadTest.LoadTestResponse;
import com.flowcheck.repository.CreditsLedgerRepository;
import com.flowcheck.repository.TestRequestRepository;
import com.flowcheck.repository.UserCouponRepository;
import com.flowcheck.repository.UserRepository;
import lombok.RequiredArgsConstructor;
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

    // TODO: 하드 코딩이라서 바꿔야 함
    private static final int TEST_COST = 10_000;

    @Transactional
    public LoadTestResponse runLoadTest(UUID userId, LoadTestRequest request) {
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
        testRequestRepository.save(testHistory);

        String deductionType;
        Long ledgerId = null;

        List<UserCoupon> availableCoupons = userCouponRepository
                .findByUserAndRemainingChancesGreaterThan(user, 0);

        if (!availableCoupons.isEmpty()) {
            // 쿠폰 사용
            UserCoupon couponToUse = availableCoupons.getFirst();
            couponToUse.useChance();
            deductionType = "COUPON";

        } else if (user.getBalance() >= TEST_COST) {
            // 잔액 사용
            user.deductBalance(TEST_COST);

            CreditsLedger ledger = CreditsLedger.builder()
                    .user(user)
                    .amount(-TEST_COST)
                    .transactionType("TEST_CONSUME")
                    .description("k6 Load Test Execution on AWS")
                    .build();
            CreditsLedger savedLedger = creditsLedgerRepository.save(ledger);
            ledgerId = savedLedger.getId();
            deductionType = "BALANCE";

        } else {
            testHistory.changeStatus("FAILED");
            throw new IllegalStateException("Insufficient coupons or balance.");
        }

        LoadTestResponse.TestResults testResults = executeK6LoadTest(request);

        testHistory.changeStatus("COMPLETED");

        int remainingCouponsCount = userCouponRepository.sumRemainingChancesByUserId(userId);

        return LoadTestResponse.builder()
                .testResults(testResults)
                .updatedUser(LoadTestResponse.UpdatedUser.builder()
                        .coupons(remainingCouponsCount)
                        .balance(user.getBalance())
                        .build())
                .deductionDetail(LoadTestResponse.DeductionDetail.builder()
                        .type(deductionType)
                        .ledgerId(ledgerId)
                        .build())
                .build();
    }

    // TODO: Test Mock Method
    private LoadTestResponse.TestResults executeK6LoadTest(LoadTestRequest request) {
        // TODO: 실제 AWS 환경의 k6 실행 로직 및 결과 파싱 로직 구현 필요
        return LoadTestResponse.TestResults.builder()
                .maxTps(1200)
                .avgResponse(0.45)
                .errorRate(0.01)
                .bottleneckDiagnosis("No major bottlenecks detected.")
                .points(List.of(
                        LoadTestResponse.ChartPoint.builder().time("10:00").tps(500).build(),
                        LoadTestResponse.ChartPoint.builder().time("10:01").tps(1200).build()
                ))
                .build();
    }
}
