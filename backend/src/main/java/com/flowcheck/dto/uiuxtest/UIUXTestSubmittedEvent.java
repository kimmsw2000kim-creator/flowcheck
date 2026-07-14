package com.flowcheck.dto.uiuxtest;

import java.util.UUID;

public record UIUXTestSubmittedEvent(UUID requestId, UIUXTestStartRequest request) {
}
