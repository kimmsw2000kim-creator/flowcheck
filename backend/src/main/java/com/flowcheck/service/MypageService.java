package com.flowcheck.service;

import com.flowcheck.domain.*;
import com.flowcheck.dto.mypage.MypagePointHistoryResponseDTO;
import com.flowcheck.dto.mypage.MypageResponseDTO;
import com.flowcheck.dto.mypage.MypageTestHistoryResponseDTO;
import com.flowcheck.dto.mypage.SiteSummaryResponseDTO;
import com.flowcheck.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MypageService {
        private final RegisteredSiteRepository registeredSiteRepository;
        private final TestRequestRepository testRequestRepository;
        private final UiTestRepository uiTestRepository;
        private final UserCouponRepository userCouponRepository;
        private final UserRepository userRepository;
        private final CreditsLedgerRepository creditsLedgerRepository;

        public MypageResponseDTO getMyPage(String email) {
                User user = userRepository.findByEmail(email)
                                .orElseThrow(() -> new IllegalArgumentException("User not found"));

                UUID userId = user.getUserId();

                int couponCount = userCouponRepository.sumRemainingChancesByUserId(userId);
                int loadTestCouponCount = userCouponRepository.sumRemainingChancesByUserIdAndCouponType(userId, CouponType.LOAD_TEST);
                int uiUxTestCouponCount = userCouponRepository.sumRemainingChancesByUserIdAndCouponType(userId, CouponType.UI_UX_TEST);
                long registeredSiteCount = registeredSiteRepository.countByUser_UserId(userId);
                long testRunCount = testRequestRepository.countByUser_UserId(userId)
                                + uiTestRepository.countByUser_UserId(userId);

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
                                // user.getCompanyName(),
                                user.getBalance(),
                                couponCount,
                                loadTestCouponCount,
                                uiUxTestCouponCount,
                                registeredSiteCount,
                                testRunCount,
                                sites);
        }

        public List<MypageTestHistoryResponseDTO> getTestHistory(String email) {
                User user = userRepository.findByEmail(email)
                                .orElseThrow(() -> new IllegalArgumentException("User not found"));

                UUID userId = user.getUserId();
                List<MypageTestHistoryResponseDTO> histories = new ArrayList<>();

                List<TestRequest> loadTests = testRequestRepository.findByUser_UserIdOrderByCreatedAtDesc(userId);

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

                List<UiTest> uiTests = uiTestRepository.findByUser_UserIdOrderByCreatedAtDesc(userId);

                uiTests.forEach(test -> histories.add(new MypageTestHistoryResponseDTO(
                                test.getId(),
                                "UI",
                                "UI/UX 테스트",
                                test.getTargetUrl(),
                                test.getStatus(),
                                null,
                                resolveUiTestProgress(test.getStatus()),
                                summarizeReport(test.getReport()),
                                test.getCreatedAt(),
                                test.getUpdatedAt())));

                histories.sort(Comparator.comparing(
                                MypageTestHistoryResponseDTO::createdAt,
                                Comparator.nullsLast(Comparator.reverseOrder())));

                return histories;
        }

        private Integer resolveUiTestProgress(String status) {
                if ("COMPLETED".equals(status) || "FAILED".equals(status)) {
                        return 100;
                }

                if ("RUNNING".equals(status)) {
                        return 50;
                }

                return 0;
        }

        private String summarizeReport(String report) {
                if (report == null || report.isBlank()) {
                        return null;
                }

                String firstLine = report.strip().lines().findFirst().orElse("");
                return firstLine.length() > 120 ? firstLine.substring(0, 120) + "..." : firstLine;
        }

        public List<MypagePointHistoryResponseDTO> getPointHistory(String email) {
                User user = userRepository.findByEmail(email)
                                .orElseThrow(() -> new IllegalArgumentException("User not found"));

                UUID userId = user.getUserId();

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
}
