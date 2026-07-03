package com.flowcheck.dto.LoadTest;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.util.UUID;

@Getter
@Builder
@AllArgsConstructor
public class LoadTestSubmitResponse {
    private UUID requestId;
    private String status;
    private String message;
}