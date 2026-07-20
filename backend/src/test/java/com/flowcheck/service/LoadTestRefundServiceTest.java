package com.flowcheck.service;

import com.flowcheck.domain.Coupon;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LoadTestRefundServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private UserCouponRepository userCouponRepository;
    @Mock
    private CreditsLedgerRepository creditsLedgerRepository;
    @Mock
    private CouponUsageLogRepository couponUsageLogRepository;

    private LoadTestRefundService service;
    private User user;
    private TestRequest request;
    private UUID requestId;

    @BeforeEach
    void setUp() {
        service = new LoadTestRefundService(
                userRepository,
                userCouponRepository,
                creditsLedgerRepository,
                couponUsageLogRepository);
        requestId = UUID.randomUUID();
        user = User.builder()
                .userId(UUID.randomUUID())
                .email("load-test@example.com")
                .balance(2_000)
                .build();
        request = TestRequest.builder()
                .id(requestId)
                .user(user)
                .targetUrl("https://example.com")
                .promptInput("")
                .testType("LOAD")
                .testStatus("RUNNING")
                .build();
    }

    @Test
    void refundsOriginalLoadTestCoupon() {
        UserCoupon userCoupon = UserCoupon.builder()
                .id(UUID.randomUUID())
                .user(user)
                .coupon(Coupon.builder()
                        .id(UUID.randomUUID())
                        .couponCode("LOAD-TEST")
                        .couponType(CouponType.LOAD_TEST)
                        .build())
                .remainingChances(2)
                .build();
        CouponUsageLog originalUse = CouponUsageLog.builder()
                .user(user)
                .testRequest(request)
                .userCoupon(userCoupon)
                .couponType(CouponType.LOAD_TEST)
                .action(CouponUsageAction.USE)
                .build();
        when(couponUsageLogRepository
                .findByTestRequest_IdAndCouponTypeAndActionOrderByUsedAtDesc(
                        requestId, CouponType.LOAD_TEST, CouponUsageAction.USE))
                .thenReturn(List.of(originalUse));

        service.refundIfNeeded(request, "target unavailable");

        assertThat(userCoupon.getRemainingChances()).isEqualTo(3);
        verify(userCouponRepository).save(userCoupon);
        ArgumentCaptor<CouponUsageLog> refundCaptor = ArgumentCaptor.forClass(CouponUsageLog.class);
        verify(couponUsageLogRepository).save(refundCaptor.capture());
        assertThat(refundCaptor.getValue().getAction()).isEqualTo(CouponUsageAction.REFUND);
        assertThat(refundCaptor.getValue().getCouponType()).isEqualTo(CouponType.LOAD_TEST);
        assertThat(refundCaptor.getValue().getTestRequest()).isSameAs(request);
        verify(userRepository, never()).save(user);
    }

    @Test
    void refundsCreditsFromActualConsumptionLedgers() {
        when(couponUsageLogRepository
                .findByTestRequest_IdAndCouponTypeAndActionOrderByUsedAtDesc(
                        requestId, CouponType.LOAD_TEST, CouponUsageAction.USE))
                .thenReturn(List.of());
        when(creditsLedgerRepository.findByTestRequest_IdAndTransactionType(
                requestId, CreditTransactionType.TEST_CONSUME))
                .thenReturn(List.of(
                        consumedLedger(-4_000),
                        consumedLedger(-6_000)));

        service.refundIfNeeded(request, "FastAPI error");

        assertThat(user.getBalance()).isEqualTo(12_000);
        verify(userRepository).save(user);
        ArgumentCaptor<CreditsLedger> refundCaptor = ArgumentCaptor.forClass(CreditsLedger.class);
        verify(creditsLedgerRepository).save(refundCaptor.capture());
        assertThat(refundCaptor.getValue().getAmount()).isEqualTo(10_000);
        assertThat(refundCaptor.getValue().getTransactionType())
                .isEqualTo(CreditTransactionType.TEST_REFUND);
        assertThat(refundCaptor.getValue().getTestRequest()).isSameAs(request);
        verify(userCouponRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void skipsDuplicateRefund() {
        when(creditsLedgerRepository.existsByTestRequest_IdAndTransactionType(
                requestId, CreditTransactionType.TEST_REFUND)).thenReturn(true);

        service.refundIfNeeded(request, "duplicate failure");

        assertThat(user.getBalance()).isEqualTo(2_000);
        verify(userRepository, never()).save(user);
        verify(creditsLedgerRepository, never()).save(org.mockito.ArgumentMatchers.any());
        verify(couponUsageLogRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void safelySkipsFailureWithoutChargeHistory() {
        when(couponUsageLogRepository
                .findByTestRequest_IdAndCouponTypeAndActionOrderByUsedAtDesc(
                        requestId, CouponType.LOAD_TEST, CouponUsageAction.USE))
                .thenReturn(List.of());
        when(creditsLedgerRepository.findByTestRequest_IdAndTransactionType(
                requestId, CreditTransactionType.TEST_CONSUME))
                .thenReturn(List.of());

        service.refundIfNeeded(request, "unknown failure");

        assertThat(user.getBalance()).isEqualTo(2_000);
        verify(userRepository, never()).save(user);
        verify(creditsLedgerRepository, never()).save(org.mockito.ArgumentMatchers.any());
        verify(couponUsageLogRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    private CreditsLedger consumedLedger(int amount) {
        return CreditsLedger.builder()
                .user(user)
                .testRequest(request)
                .amount(amount)
                .transactionType(CreditTransactionType.TEST_CONSUME)
                .build();
    }
}
