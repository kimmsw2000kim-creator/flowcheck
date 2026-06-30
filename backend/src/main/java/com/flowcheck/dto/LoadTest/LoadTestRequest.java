package com.flowcheck.dto.LoadTest;

public record LoadTestRequest(
        String targetUrl,
        int vusers,
        int duration,
        String loadPrompt
) {
}