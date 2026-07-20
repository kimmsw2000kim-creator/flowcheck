package com.flowcheck.dto.uiuxtest;

// VNC signed URL 발급 API 응답입니다.
// ready=false이면 컨테이너/VNC 서버가 아직 준비 중이라는 뜻이고, 프론트는 제한된 횟수만 재시도합니다.
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
