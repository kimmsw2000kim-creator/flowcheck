package com.flowcheck.dto.payment;

public record CreditsLedgerResponseDto(
    Long id,
    Integer amount,
    String type,
    String description,
    String createdAt
) {}
