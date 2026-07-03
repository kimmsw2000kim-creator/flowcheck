package com.flowcheck.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Sign-In / Me", description = "로그인 사용자 관련 임시/테스트 API")
@RestController
@RequestMapping("/api")
public class SignInController {

    @Operation(summary = "공개 헬로", description = "누구나 접근 가능한 공개 API 테스트용 엔드포인트입니다.")
    @GetMapping("/public/hello")
    public String publicHello() {
        return "공개 API입니다.";
    }

    @Operation(summary = "현재 사용자 정보 조회", description = "인증된 JWT 토큰으로부터 사용자의 ID와 이메일을 가져옵니다.")
    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal Jwt jwt) {
        return new UserResponse(
                jwt.getSubject(),
                jwt.getClaimAsString("email"));
    }

    record UserResponse(String userId, String email) {
    }
}