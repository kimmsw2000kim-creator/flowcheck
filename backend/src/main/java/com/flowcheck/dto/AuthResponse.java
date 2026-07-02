package com.flowcheck.dto;

public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    private String email;
    private String message;

    public AuthResponse(String accessToken, String refreshToken, String email, String message) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.email = email;
        this.message = message;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public String getEmail() {
        return email;
    }

    public String getMessage() {
        return message;
    }
}