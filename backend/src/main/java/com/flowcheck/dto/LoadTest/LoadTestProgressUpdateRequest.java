package com.flowcheck.dto.LoadTest;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record LoadTestProgressUpdateRequest(
        @NotBlank String status,
        @NotBlank String phase,
        @NotNull @Min(0) Integer progress,
        String message) {
}