package com.flowcheck.dto.mypage;

import java.time.OffsetDateTime;

public record MypageCouponHistoryResponseDTO (
        Long logId,
        String couponType,
        String description,
        OffsetDateTime usedAt
){
}
