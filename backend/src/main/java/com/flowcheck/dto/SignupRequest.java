package com.flowcheck.dto;

public class SignupRequest {
    private String email;
    private String password;
    private String nickname;

    public String getEmail() {
        return email;
    }

    public String getPassword() {
        return password;
    }

    public String getNickname() {
        return nickname;
    }
}