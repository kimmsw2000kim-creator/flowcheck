package com.flowcheck.service;

import com.flowcheck.domain.UserStatus;
import com.flowcheck.dto.admin.AdminStatsResponse;
import com.flowcheck.repository.CreditsLedgerRepository;
import com.flowcheck.repository.RegisteredSiteRepository;
import com.flowcheck.repository.TestRequestRepository;
import com.flowcheck.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminStatsService {

    private static final ZoneId KOREA_ZONE = ZoneId.of("Asia/Seoul");
    private static final int DAILY_RANGE = 7;

    private final UserRepository userRepository;
    private final RegisteredSiteRepository registeredSiteRepository;
    private final TestRequestRepository testRequestRepository;
    private final CreditsLedgerRepository creditsLedgerRepository;

    public AdminStatsResponse getStats() {
        LocalDate today = LocalDate.now(KOREA_ZONE);

        return new AdminStatsResponse(
                userRepository.count(),
                userRepository.countByStatus(UserStatus.ACTIVE),
                registeredSiteRepository.countByIsVerifiedTrue(),
                testRequestRepository.count(),
                testRequestRepository.countByTestStatusIgnoreCase("COMPLETED"),
                creditsLedgerRepository.sumConsumedCredits(),
                createDailyStats(today),
                OffsetDateTime.now(KOREA_ZONE)
        );
    }

    // 최근 7일을 한국 시간 기준으로 집계
    private List<AdminStatsResponse.DailyStats> createDailyStats(LocalDate today) {
        List<AdminStatsResponse.DailyStats> dailyStats = new ArrayList<>();

        for (int daysAgo = DAILY_RANGE - 1; daysAgo >= 0; daysAgo--) {
            LocalDate date = today.minusDays(daysAgo);
            OffsetDateTime start = date.atStartOfDay(KOREA_ZONE).toOffsetDateTime();
            OffsetDateTime end = date.plusDays(1).atStartOfDay(KOREA_ZONE).toOffsetDateTime();

            dailyStats.add(new AdminStatsResponse.DailyStats(
                    date,
                    userRepository.countByCreatedAtGreaterThanEqualAndCreatedAtLessThan(start, end),
                    testRequestRepository.countByCreatedAtGreaterThanEqualAndCreatedAtLessThan(start, end),
                    creditsLedgerRepository.sumConsumedCreditsBetween(start, end)
            ));
        }

        return List.copyOf(dailyStats);
    }
}
