package com.flowcheck.controller;

import com.flowcheck.dto.MypageResponseDTO;
import com.flowcheck.service.MypageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "My Page", description = "마이페이지 API")
@RestController
@RequiredArgsConstructor
public class MypageController {

    private final MypageService myPageService;

    @Operation(summary = "마이페이지 정보 조회", description = "인증된 사용자의 이메일을 기반으로 마이페이지 정보를 조회합니다.")
    @GetMapping("/api/mypage")
    public ResponseEntity<MypageResponseDTO> getMyPage(Authentication authentication) {
        String email = authentication.getName();

        MypageResponseDTO responseDTO = myPageService.getMyPage(email);

        return ResponseEntity.ok(responseDTO);
    }
}
