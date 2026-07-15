package com.flowcheck.service;

import com.flowcheck.domain.CouponType;
import com.flowcheck.domain.CouponUsageLog;
import com.flowcheck.domain.CreditsLedger;
import com.flowcheck.domain.RegisteredSite;
import com.flowcheck.domain.TestRequest;
import com.flowcheck.domain.User;
import com.flowcheck.dto.mypage.MypageCouponHistoryResponseDTO;
import com.flowcheck.dto.mypage.MypagePointHistoryResponseDTO;
import com.flowcheck.dto.mypage.MypageResponseDTO;
import com.flowcheck.dto.mypage.MypageTestHistoryResponseDTO;
import com.flowcheck.dto.mypage.SiteSummaryResponseDTO;
import com.flowcheck.dto.uiuxtest.UIUXTestStatusResponse;
import com.flowcheck.repository.CouponUsageLogRepository;
import com.flowcheck.repository.CreditsLedgerRepository;
import com.flowcheck.repository.RegisteredSiteRepository;
import com.flowcheck.repository.TestRequestRepository;
import com.flowcheck.repository.UserCouponRepository;
import com.flowcheck.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MypageService {
        private final RegisteredSiteRepository registeredSiteRepository;
        private final TestRequestRepository testRequestRepository;
        private final UserCouponRepository userCouponRepository;
        private final UserRepository userRepository;
        private final CreditsLedgerRepository creditsLedgerRepository;
        private final CouponUsageLogRepository couponUsageLogRepository;
        private final UIUXTestService uiuxTestService;

        public MypageResponseDTO getMyPage(UUID userId) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new IllegalArgumentException("User not found"));

                int couponCount = userCouponRepository.sumRemainingChancesByUserId(userId);
                int loadTestCouponCount = userCouponRepository.sumRemainingChancesByUserIdAndCouponType(userId, CouponType.LOAD_TEST);
                int UIUXTestCouponCount = userCouponRepository.sumRemainingChancesByUserIdAndCouponType(userId, CouponType.UIUX_TEST);
                long registeredSiteCount = registeredSiteRepository.countByUser_UserId(userId);
                long testRunCount = testRequestRepository.countByUser_UserId(userId);

                List<RegisteredSite> registeredSites = registeredSiteRepository
                                .findByUser_UserIdOrderByCreatedAtDesc(userId);

                List<SiteSummaryResponseDTO> sites = registeredSites.stream()
                                .map(site -> new SiteSummaryResponseDTO(
                                                site.getId(),
                                                site.getServiceName(),
                                                site.getDomainUrl(),
                                                site.getIsVerified(),
                                                site.getCreatedAt()))
                                .toList();

                return new MypageResponseDTO(
                                user.getEmail(),
                                user.getBalance(),
                                couponCount,
                                loadTestCouponCount,
                                UIUXTestCouponCount,
                                registeredSiteCount,
                                testRunCount,
                                sites);
        }

        public List<MypageTestHistoryResponseDTO> getTestHistory(UUID userId) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new IllegalArgumentException("User not found"));

                List<MypageTestHistoryResponseDTO> histories = new ArrayList<>();

                List<TestRequest> loadTests = testRequestRepository.findByUserAndTestTypeOrderByCreatedAtAsc(user, "LOAD");
                loadTests.forEach(test -> histories.add(new MypageTestHistoryResponseDTO(
                                test.getId(),
                                "LOAD",
                                "부하 테스트",
                                test.getTargetUrl(),
                                test.getTestStatus(),
                                test.getTestPhase(),
                                test.getTestProgress(),
                                test.getPromptInput(),
                                test.getCreatedAt(),
                                test.getUpdatedAt())));

                List<TestRequest> uiRequests = testRequestRepository.findByUserAndTestTypeOrderByCreatedAtAsc(user, "UIUX");
                uiRequests.forEach(test -> histories.add(new MypageTestHistoryResponseDTO(
                                test.getId(),
                                "UIUX",
                                "UI/UX 테스트",
                                test.getTargetUrl(),
                                test.getTestStatus(),
                                test.getTestPhase(),
                                test.getTestProgress(),
                                test.getPromptInput(),
                                test.getCreatedAt(),
                                test.getUpdatedAt())));

                histories.sort(Comparator.comparing(
                                MypageTestHistoryResponseDTO::createdAt,
                                Comparator.nullsLast(Comparator.reverseOrder())));

                return histories;
        }

        public UIUXTestStatusResponse getUIUXTestDetail(UUID userId, UUID requestId) {
                return uiuxTestService.getTestStatusForUser(userId, requestId);
        }

        public List<MypagePointHistoryResponseDTO> getPointHistory(UUID userId) {
                List<CreditsLedger> ledgers = creditsLedgerRepository.findByUser_UserIdOrderByCreatedAtDesc(userId);

                return ledgers.stream()
                                .map(ledger -> new MypagePointHistoryResponseDTO(
                                                ledger.getId(),
                                                ledger.getAmount(),
                                                ledger.getTransactionType(),
                                                ledger.getDescription(),
                                                ledger.getCreatedAt()))
                                .toList();
        }

        public List<MypageCouponHistoryResponseDTO> getCouponUsageHistory(UUID userId) {
                if (!userRepository.existsById(userId)) {
                        throw new IllegalArgumentException("User not found");
                }

                List<CouponUsageLog> logs = couponUsageLogRepository.findByUser_UserIdOrderByUsedAtDesc(userId);

                return logs.stream()
                                .map(log -> new MypageCouponHistoryResponseDTO(
                                                log.getId(),
                                                log.getCouponType() != null ? log.getCouponType().name() : "UNKNOWN",
                                                log.getDescription(),
                                                log.getUsedAt()))
                                .toList();
        }
}
