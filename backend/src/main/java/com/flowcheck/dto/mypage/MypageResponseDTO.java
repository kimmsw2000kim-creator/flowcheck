package com.flowcheck.dto.mypage;

import java.util.List;

public record MypageResponseDTO(

                String email,
                // String companyName;
                Integer balance,
                Integer couponCount,
                Integer loadTestCouponCount,
                Integer UIUXTestCouponCount,
                Long registeredSiteCount,
                Long testRunCount,
                List<SiteSummaryResponseDTO> sites) {}
