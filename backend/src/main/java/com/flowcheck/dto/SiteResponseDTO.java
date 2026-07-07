package com.flowcheck.dto;

import com.flowcheck.domain.RegisteredSite;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SiteResponseDTO {
    private Long id;
    private String domainUrl;
    private String verificationToken;
    private Boolean verified;
    private OffsetDateTime createdAt;
    private String serviceName;

    public static SiteResponseDTO fromEntity(RegisteredSite site) {
        return SiteResponseDTO.builder()
                .id(site.getId())
                .domainUrl(site.getDomainUrl())
                .verificationToken(site.getVerificationToken())
                .verified(site.getIsVerified())
                .createdAt(site.getCreatedAt())
                .serviceName(site.getServiceName())
                .build();
    }
}
