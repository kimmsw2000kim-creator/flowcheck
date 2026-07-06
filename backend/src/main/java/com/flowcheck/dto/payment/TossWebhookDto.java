package com.flowcheck.dto.payment;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TossWebhookDto(
    String eventType,
    Data data
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Data(
        String orderId,
        String paymentKey,
        String status,
        String secret
    ) {}

    public String getOrderId() {
        return (data != null) ? data.orderId() : null;
    }
}
