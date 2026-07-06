package com.flowcheck.dto;

public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    private String email;
    private String userId;
    private String message;

    public AuthResponse(String accessToken, String refreshToken, String email, String userId, String message) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.email = email;
        this.userId = userId;
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

    public String getUserId() {return userId;}

    public String getMessage() {
        return message;
    }
}