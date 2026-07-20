package com.flowcheck.service;

import com.flowcheck.domain.CouponType;
import com.flowcheck.domain.CouponUsageAction;
import com.flowcheck.domain.CouponUsageLog;
import com.flowcheck.domain.CreditTransactionType;
import com.flowcheck.domain.CreditsLedger;
import com.flowcheck.domain.TestRequest;
import com.flowcheck.domain.User;
import com.flowcheck.domain.UserCoupon;
import com.flowcheck.repository.CouponUsageLogRepository;
import com.flowcheck.repository.CreditsLedgerRepository;
import com.flowcheck.repository.UserCouponRepository;
import com.flowcheck.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class LoadTestRefundService {

    private final UserRepository userRepository;
    private final UserCouponRepository userCouponRepository;
    private final CreditsLedgerRepository creditsLedgerRepository;
    private final CouponUsageLogRepository couponUsageLogRepository;

    @Transactional(propagation = Propagation.MANDATORY)
    public void refundIfNeeded(TestRequest testRequest, String reason) {
        if (!"LOAD".equals(testRequest.getTestType())) {
            throw new IllegalArgumentException("Only load test requests can be refunded here.");
        }

        UUID requestId = testRequest.getId();
        if (creditsLedgerRepository.existsByTestRequest_IdAndTransactionType(
                requestId, CreditTransactionType.TEST_REFUND)
                || couponUsageLogRepository.existsByTestRequest_IdAndCouponTypeAndAction(
                        requestId, CouponType.LOAD_TEST, CouponUsageAction.REFUND)) {
            log.info("Load test request {} has already been refunded.", requestId);
            return;
        }

        List<CouponUsageLog> couponUses = couponUsageLogRepository
                .findByTestRequest_IdAndCouponTypeAndActionOrderByUsedAtDesc(
                        requestId, CouponType.LOAD_TEST, CouponUsageAction.USE);
        if (!couponUses.isEmpty()) {
            refundCoupon(testRequest, couponUses.getFirst(), reason);
            return;
        }

        refundCredits(testRequest, reason);
    }

    private void refundCoupon(TestRequest testRequest, CouponUsageLog originalUse, String reason) {
        UserCoupon usedCoupon = originalUse.getUserCoupon();
        if (usedCoupon == null) {
            log.warn(
                    "Load test request {} has coupon usage without a user coupon. Refund skipped.",
                    testRequest.getId());
            return;
        }

        usedCoupon.refundChance();
        userCouponRepository.save(usedCoupon);
        couponUsageLogRepository.save(CouponUsageLog.builder()
                .user(testRequest.getUser())
                .testRequest(testRequest)
                .userCoupon(usedCoupon)
                .couponType(CouponType.LOAD_TEST)
                .action(CouponUsageAction.REFUND)
                .description("Load test failure coupon refund (" + safeReason(reason) + ")")
                .build());
        log.info("Refunded one load test coupon chance for request {}.", testRequest.getId());
    }

    private void refundCredits(TestRequest testRequest, String reason) {
        List<CreditsLedger> consumedLedgers = creditsLedgerRepository
                .findByTestRequest_IdAndTransactionType(
                        testRequest.getId(), CreditTransactionType.TEST_CONSUME);
        int refundAmount = consumedLedgers.stream()
                .map(CreditsLedger::getAmount)
                .filter(amount -> amount != null && amount < 0)
                .mapToInt(amount -> -amount)
                .sum();
        if (refundAmount <= 0) {
            log.info("Load test request {} has no refundable charge.", testRequest.getId());
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
                .description("Load test failure credit refund (" + safeReason(reason) + ")")
                .build());
        log.info("Refunded {} credits for load test request {}.", refundAmount, testRequest.getId());
    }

    private String safeReason(String reason) {
        return reason == null || reason.isBlank() ? "unknown failure" : reason;
    }
}
