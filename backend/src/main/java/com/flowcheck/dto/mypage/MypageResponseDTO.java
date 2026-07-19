package com.flowcheck.dto.mypage;

import com.flowcheck.domain.Role;

import java.util.List;

public record MypageResponseDTO(

                String email,
                Role role,
                String status,
                String avatarUrl,
                // String companyName;
                Integer balance,
                Integer couponCount,
                Integer loadTestCouponCount,
                Integer UIUXTestCouponCount,
                Long registeredSiteCount,
                Long testRunCount,
                List<SiteSummaryResponseDTO> sites) {}
