package com.flowcheck.dto.payment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record PaymentConfirmRequestDto(
    @NotBlank(message = "paymentKey는 필수입니다.")
    String paymentKey,
    @NotBlank(message = "orderId는 필수입니다.")
    String orderId,
    @NotNull(message = "결제 금액은 필수입니다.")
    @Positive(message = "결제 금액은 0보다 커야 합니다.")
    Integer amount
) {}
