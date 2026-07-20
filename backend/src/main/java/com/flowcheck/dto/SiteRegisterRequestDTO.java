package com.flowcheck.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class SiteRegisterRequestDTO {
    @NotBlank(message = "도메인 URL은 필수 입력 항목입니다.")
    @Size(max = 2048, message = "도메인 URL은 2048자 이하로 입력해 주세요.")
    private String domainUrl;

    @Size(max = 100, message = "서비스 이름은 100자 이하로 입력해 주세요.")
    private String serviceName;
}
