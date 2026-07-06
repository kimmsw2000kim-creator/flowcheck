package com.flowcheck.dto.payment;

import java.time.OffsetDateTime;

public record PaymentHistoryResponseDto(
    Long paymentId,
    String orderId,
    String paymentKey,
    Integer amount,
    String accountNumber,
    String bankCode,
    String customerName,
    String paymentStatus,
    OffsetDateTime dueDate,
    OffsetDateTime createdAt
) {}
