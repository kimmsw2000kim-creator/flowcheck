package com.flowcheck.dto.LoadTest;

import lombok.Builder;

@Builder
public record UpdatedUser(
        int coupons,
        int balance
) {
}
