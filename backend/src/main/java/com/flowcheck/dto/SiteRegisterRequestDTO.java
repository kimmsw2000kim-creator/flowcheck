package com.flowcheck.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class SiteRegisterRequestDTO {
    @NotBlank(message = "도메인 URL은 필수 입력 항목입니다.")
    private String domainUrl;

    private String serviceName;
}
