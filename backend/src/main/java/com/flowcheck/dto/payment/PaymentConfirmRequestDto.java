package com.flowcheck.dto.payment;

public record PaymentConfirmRequestDto(
    String paymentKey,
    String orderId,
    Integer amount
) {}
