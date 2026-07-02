package com.flowcheck.controller;

import com.flowcheck.dto.MypageResponseDTO;
import com.flowcheck.service.MypageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class MypageController {

    private final MypageService myPageService;

    @GetMapping("/api/mypage")
    public ResponseEntity<MypageResponseDTO> getMyPage(Authentication authentication) {
        String email = authentication.getName();

        MypageResponseDTO responseDTO = myPageService.getMyPage(email);

        return ResponseEntity.ok(responseDTO);
    }
}
