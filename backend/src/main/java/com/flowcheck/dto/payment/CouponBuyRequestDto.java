package com.flowcheck.dto.payment;

import com.flowcheck.domain.CouponType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record CouponBuyRequestDto(
        @Min(value = 1, message = "쿠폰 구매 수량은 1개 이상이어야 합니다.")
        int count,
        @NotNull(message = "쿠폰 유형은 필수입니다.")
        CouponType couponType) {
}
