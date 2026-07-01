package com.flowcheck.service;

import com.flowcheck.domain.Coupon;
import com.flowcheck.domain.User;
import com.flowcheck.domain.UserCoupon;
import com.flowcheck.dto.LoadTest.LoadTestRequest;
import com.flowcheck.dto.LoadTest.LoadTestResponse;
import com.flowcheck.repository.CouponRepository;
import com.flowcheck.repository.TestRequestRepository;
import com.flowcheck.repository.UserCouponRepository;
import com.flowcheck.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
public class LoadTestServiceTest {
    @Autowired
    private LoadTestService loadTestService;
    @Autowired private UserRepository userRepository;
    @Autowired private CouponRepository couponRepository;
    @Autowired private UserCouponRepository userCouponRepository;
    @Autowired private TestRequestRepository testRequestRepository;

    private User testUser;

    @BeforeEach
    void setUp() {
        // 1. 매 테스트가 실행되기 전, 가짜(Dummy) 유저와 쿠폰 데이터를 DB에 셋업합니다.
        testUser = User.builder()
                .userId(UUID.randomUUID())
                .email("test-user@flowcheck.com")
                .balance(5000) // 잔액은 10000보다 작게 설정 (쿠폰이 먼저 쓰이는지 확인하기 위해)
                .role("USER")
                .status("ACTIVE")
                .createdAt(OffsetDateTime.now())
                .build();
        testUser = userRepository.saveAndFlush(testUser);

        Coupon coupon = new Coupon();
        coupon.setId(UUID.randomUUID());
        coupon.setCouponCode("TEST-COUPON-123");
        coupon.setTestCount(1);
        coupon.setCreditPrice(0);
        coupon.setIsActive(true);
        Coupon savedCoupon = couponRepository.saveAndFlush(coupon);

        UserCoupon userCoupon = new UserCoupon();
        userCoupon.setId(UUID.randomUUID());
        userCoupon.setUser(testUser);
        userCoupon.setCoupon(savedCoupon);
        userCoupon.setRemainingChances(1); // 쿠폰 1회 사용 가능
        userCoupon.setCreatedAt(OffsetDateTime.now());
        userCouponRepository.saveAndFlush(userCoupon);
    }

    @Test
    @DisplayName("쿠폰이 있을 경우: 잔액 차감 없이 쿠폰이 차감되고 마스터 이력서가 생성된다.")
    void runLoadTest_WithCoupon_Success() {
        // Given (준비): 프론트엔드에서 넘어올 Request 데이터 세팅
        LoadTestRequest request = new LoadTestRequest();
        request.setTargetUrl("https://test.flowcheck.com");
        request.setVusers(100);
        request.setDuration(60);
        request.setLoadPrompt("테스트 프롬프트입니다.");

        // When (실행): 우리가 만든 핵심 비즈니스 로직 실행
        LoadTestResponse response = loadTestService.runLoadTest(testUser.getUserId(), request);

        // Then (검증): 결과가 우리가 예상한 대로 나왔는지 꼼꼼하게 확인
        // 1. Response DTO 검증
        assertThat(response.getDeductionDetail().getType()).isEqualTo("COUPON");
        assertThat(response.getUpdatedUser().getCoupons()).isEqualTo(0); // 1개에서 0개로 줄어야 함
        assertThat(response.getUpdatedUser().getBalance()).isEqualTo(5000); // 잔액은 그대로여야 함

        // 2. DB 마스터 이력서(TestRequest)가 잘 저장되었는지 검증
        long historyCount = testRequestRepository.count();
        assertThat(historyCount).isEqualTo(1); // 이력이 1줄 생겼는지 확인
    }
}
