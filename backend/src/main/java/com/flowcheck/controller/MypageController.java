package com.flowcheck.controller;


import com.flowcheck.dto.mypage.MypageCouponHistoryResponseDTO;
import com.flowcheck.dto.mypage.MypagePointHistoryResponseDTO;
import com.flowcheck.dto.mypage.MypageResponseDTO;
import com.flowcheck.dto.mypage.MypageTestHistoryResponseDTO;
import com.flowcheck.service.MypageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class MypageController {

    private final MypageService myPageService;


    @GetMapping("/api/mypage")
    public ResponseEntity<MypageResponseDTO> getMyPage(
            @AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());

        MypageResponseDTO responseDTO = myPageService.getMyPage(userId);

        return ResponseEntity.ok(responseDTO);
    }

    @GetMapping("/api/mypage/tests")
    public ResponseEntity<List<MypageTestHistoryResponseDTO>> getMyTestHistory(
            @AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        List<MypageTestHistoryResponseDTO> response = myPageService.getTestHistory(userId);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/api/mypage/points/history")
    public ResponseEntity<List<MypagePointHistoryResponseDTO>> getMypagePointHistory(
            @AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        List<MypagePointHistoryResponseDTO> response = myPageService.getPointHistory(userId);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/api/mypage/coupons/history")
    public ResponseEntity<List<MypageCouponHistoryResponseDTO>> getMypageCouponHistory(
            @AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        List<MypageCouponHistoryResponseDTO> response = myPageService.getCouponUsageHistory(userId);

        return ResponseEntity.ok(response);
    }
}
