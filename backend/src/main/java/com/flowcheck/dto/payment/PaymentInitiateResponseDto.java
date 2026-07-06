package com.flowcheck.dto.payment;

public record PaymentInitiateResponseDto(
    String clientKey,
    String customerKey,
    String orderId,
    String orderName,
    Integer amount
) {}
