package com.flowcheck.dto.LoadTest;

import java.util.UUID;

public record LoadTestSubmittedEvent(UUID requestId, LoadTestRequest request) {
}
