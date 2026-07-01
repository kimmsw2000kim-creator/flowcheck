package com.flowcheck.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2..jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class UserController {

    @GetMapping("/public/hello")
    public String publicHello() {
        return "공개 API입니다.";
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal Jwt jwt) {
        return new UserResponse(
                jwt.getSubject(),
                jwt.getClaimAsString("email"));
    }

    record UserResponse(String userId, String email) {
    }
}