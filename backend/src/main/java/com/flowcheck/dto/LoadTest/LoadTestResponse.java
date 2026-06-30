package com.flowcheck.dto.LoadTest;

import lombok.Builder;

@Builder
public record LoadTestResponse(
        TestResults testResults,
        UpdatedUser updatedUser,
        DeductionDetail deductionDetail
) {
}
