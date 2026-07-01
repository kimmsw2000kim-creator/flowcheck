package com.flowcheck.dto;

import java.util.List;

public record MypageResponseDTO(

        String email,
        //String companyName;
        Integer balance,
        Integer couponCount,
        Long registeredSiteCount,
        Long testRunCount,
        List<SiteSummaryResponseDTO> sites
)

    {
}
