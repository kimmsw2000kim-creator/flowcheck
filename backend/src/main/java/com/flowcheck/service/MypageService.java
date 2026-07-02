package com.flowcheck.service;

import com.flowcheck.domain.RegisteredSite;
import com.flowcheck.domain.User;
import com.flowcheck.dto.MypageResponseDTO;
import com.flowcheck.dto.SiteSummaryResponseDTO;
import com.flowcheck.repository.RegisteredSiteRepository;
import com.flowcheck.repository.TestRequestRepository;
import com.flowcheck.repository.UserCouponRepository;
import com.flowcheck.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MypageService {
    private final RegisteredSiteRepository registeredSiteRepository;
    private final TestRequestRepository testRequestRepository;
    private final UserCouponRepository userCouponRepository;
    private final UserRepository userRepository;

    public MypageResponseDTO getMyPage(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        UUID userId = user.getUserId();

        int couponCount = userCouponRepository.sumRemainingChancesByUserId(userId);
        long registeredSiteCount = registeredSiteRepository.countByUser_UserId(userId);
        long testRunCount = testRequestRepository.countByUser_UserId(userId);

        List<RegisteredSite> registeredSites =
                registeredSiteRepository.findByUser_UserIdOrderByCreatedAtDesc(userId);

        List<SiteSummaryResponseDTO> sites = registeredSites.stream()
                .map(site -> new SiteSummaryResponseDTO(
                        site.getId(),
                        site.getServiceName(),
                        site.getDomainUrl(),
                        site.getIsVerified(),
                        site.getCreatedAt()
                ))
                .toList();

        return new MypageResponseDTO(
                user.getEmail(),
                //user.getCompanyName(),
                user.getBalance(),
                couponCount,
                registeredSiteCount,
                testRunCount,
                sites
        );
    }
}
