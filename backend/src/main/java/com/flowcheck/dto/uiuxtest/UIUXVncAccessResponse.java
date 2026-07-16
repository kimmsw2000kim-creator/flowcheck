package com.flowcheck.dto.uiuxtest;

public record UIUXVncAccessResponse(
        boolean ready,
        String url,
        long expiresAt,
        String message
) {
    public static UIUXVncAccessResponse ready(String url, long expiresAt) {
        return new UIUXVncAccessResponse(true, url, expiresAt, null);
    }

    public static UIUXVncAccessResponse pending(String message) {
        return new UIUXVncAccessResponse(false, null, 0L, message);
    }
}
