package com.flowcheck.service;

import com.flowcheck.domain.User;
import com.flowcheck.domain.UserCoupon;
import com.flowcheck.dto.LoadTest.*;
import com.flowcheck.repository.UserCouponRepository;
import com.flowcheck.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LoadTestService {

    private final UserRepository userRepository;
    private final UserCouponRepository userCouponRepository;

    // TODO: 하드코딩 되었으므로 추후 수정 필요
    private static final int TEST_COST = 10000;

    @Transactional
    public LoadTestResponse runLoadTest(UUID userId, LoadTestRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<UserCoupon> availableCoupons = userCouponRepository
                .findByUser_UserIdAndRemainingChancesGreaterThan(userId, 0);

        String deductionType;
        Long ledgerId = null;
        int totalRemainingCoupons = availableCoupons.stream()
                .mapToInt(UserCoupon::getRemainingChances).sum();

        if (!availableCoupons.isEmpty()) {
            // 쿠폰 사용
            UserCoupon couponToUse = availableCoupons.get(0);
            couponToUse.setRemainingChances(couponToUse.getRemainingChances() - 1);
            userCouponRepository.save(couponToUse); // 변경감지로 인해 생략 가능하나 명시적 작성
            deductionType = "COUPON";
            totalRemainingCoupons -= 1; // 응답용 계산

        } else if (user.getBalance() >= TEST_COST) {
            // 잔액 사용
            user.setBalance(user.getBalance() - TEST_COST);
            userRepository.save(user); // 변경감지 적용
            deductionType = "BALANCE";

            // TODO: 실제 서비스라면 여기에 Ledger(장부) 테이블에 INSERT 하는 로직 추가
            // Ledger ledger = ledgerRepository.save(new Ledger(user, -TEST_COST, "TEST_CONSUME"));
            // ledgerId = ledger.getId();

        } else {
            // 둘 다 부족하면 예외 발생 (400 Bad Request로 처리되도록 ExceptionHandler 연동 필요)
            throw new IllegalStateException("Insufficient coupons or balance.");
        }

        // 4. 부하 테스트 실행 (현재는 프론트엔드의 Mock 로직을 백엔드로 가져옴)
        // 실제로는 여기서 AWS Lambda, ECS, 또는 별도의 Python(Locust) 서버로 HTTP/gRPC 요청을 보냅니다.
        TestResults results = mockLoadTestExecution(request);

        // 5. 프론트엔드가 요구하는 형식으로 조립하여 반환
        return LoadTestResponse.builder()
                .testResults(results)
                .updatedUser(new UpdatedUser(totalRemainingCoupons, user.getBalance()))
                .deductionDetail(new DeductionDetail(deductionType, ledgerId))
                .build();
    }

    // 부하 테스트 Mocking 메서드 (프론트 로직 이관)
    private TestResults mockLoadTestExecution(LoadTestRequest request) {
        int vusers = request.vusers();
        int duration = request.duration();

        List<ChartPoint> points = new ArrayList<>();
        for (int i = 0; i <= duration; i += 3) {
            int currentUsers = Math.min(vusers, (int)((i / (double)duration) * vusers * 1.5));
            double tps = (vusers * 1.5) * 0.7 + (Math.random() * vusers * 0.5);
            double avgResponse = (120 + (vusers * 0.3)) * 0.9 + (Math.random() * 40);

            points.add(new ChartPoint(i + "s", currentUsers, Math.floor(tps), Math.floor(avgResponse)));
        }

        return TestResults.builder()
                .maxTps(vusers * 1.8)
                .avgResponse(120 + (vusers * 0.4))
                .errorRate(vusers > 200 ? 4.8 : 0.0)
                .bottleneckDiagnosis(String.format("# Bottleneck Analysis for %s\n- Max TPS: %.1f req/s\n- Suggest database queries scaling.", request.targetUrl(), vusers * 1.8))
                .points(points)
                .build();
    }
}
