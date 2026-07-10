package com.flowcheck.service;

import com.flowcheck.domain.*;
import com.flowcheck.dto.mypage.*;
import com.flowcheck.repository.*;
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
        private final UiUxTestReportRepository uiUxTestReportRepository;
        private final UserCouponRepository userCouponRepository;
        private final UserRepository userRepository;
        private final CreditsLedgerRepository creditsLedgerRepository;
        private final CouponUsageLogRepository couponUsageLogRepository;

        public MypageResponseDTO getMyPage(String email) {
                User user = userRepository.findByEmail(email)
                                .orElseThrow(() -> new IllegalArgumentException("User not found"));

                UUID userId = user.getUserId();

                int couponCount = userCouponRepository.sumRemainingChancesByUserId(userId);
                int loadTestCouponCount = userCouponRepository.sumRemainingChancesByUserIdAndCouponType(userId, CouponType.LOAD_TEST);
                int uiUxTestCouponCount = userCouponRepository.sumRemainingChancesByUserIdAndCouponType(userId, CouponType.UIUX_TEST);
                long registeredSiteCount = registeredSiteRepository.countByUser_UserId(userId);
                
                // 마스터 테이블인 test_requests 단일 개수로 총 실행 횟수 계산 변경
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

                // 1. 부하 테스트(LOAD) 이력 추출
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

                // 2. UI/UX 테스트(UI) 이력 추출 (test_requests 테이블 내에서 UI 타입 필터링)
                List<TestRequest> uiRequests = testRequestRepository.findByUserAndTestTypeOrderByCreatedAtAsc(user, "UI");
                uiRequests.forEach(test -> {
                        // 세부 분석 보고서 텍스트 추출 매핑 조정
                        String reportMarkdown = uiUxTestReportRepository.findByTestRequestId(test.getId())
                                        .map(UiUxTestReport::getAiUxReview)
                                        .orElse("");

                        histories.add(new MypageTestHistoryResponseDTO(
                                        test.getId(),
                                        "UI",
                                        "UI/UX 테스트",
                                        test.getTargetUrl(),
                                        test.getTestStatus(),
                                        test.getTestPhase(),
                                        test.getTestProgress(),
                                        test.getPromptInput(),
                                        test.getCreatedAt(),
                                        test.getUpdatedAt()));
                });

                histories.sort(Comparator.comparing(
                                MypageTestHistoryResponseDTO::createdAt,
                                Comparator.nullsLast(Comparator.reverseOrder())));

                return histories;
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

        public List<MypageCouponHistoryResponseDTO> getCouponUsageHistory(String email) {
                User user = userRepository.findByEmail(email)
                                .orElseThrow(() -> new IllegalArgumentException("User not found"));

                UUID userId = user.getUserId();

                List<CouponUsageLog> logs = couponUsageLogRepository.findByUser_UserIdOrderByUsedAtDesc(userId);

                return logs.stream()
                                .map(log -> new MypageCouponHistoryResponseDTO(
                                                log.getId(),
                                                log.getCouponType().name(),
                                                log.getDescription(),
                                                log.getUsedAt()))
                                .toList();
        }
}