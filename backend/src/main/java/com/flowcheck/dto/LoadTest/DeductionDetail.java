package com.flowcheck.dto.LoadTest;

import lombok.Builder;

@Builder
public record DeductionDetail(
        String type,
        Long ledgerId
) {
}
