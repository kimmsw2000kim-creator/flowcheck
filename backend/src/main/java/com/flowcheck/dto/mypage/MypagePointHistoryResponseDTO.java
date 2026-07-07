package com.flowcheck.dto.mypage;

import java.time.OffsetDateTime;

public record MypagePointHistoryResponseDTO (
        Long ledgerId,
        Integer amount,
        String transactionType,
        String description,
        OffsetDateTime createdAt

)
{

}
