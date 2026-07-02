package com.flowcheck.dto;

import java.time.OffsetDateTime;

public record SiteSummaryResponseDTO(

    Long siteId,
    String serviceName,
    String domainURL,
    Boolean isVerified,
    OffsetDateTime createdAt

)   {
}
