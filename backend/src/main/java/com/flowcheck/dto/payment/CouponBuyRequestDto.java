package com.flowcheck.dto.payment;

import com.flowcheck.domain.CouponType;

public record CouponBuyRequestDto(
        int count,
        CouponType couponType) {
}
