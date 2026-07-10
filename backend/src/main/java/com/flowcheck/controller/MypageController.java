package com.flowcheck.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
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

@RestController
@RequiredArgsConstructor
public class MypageController {

    private final MypageService myPageService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @GetMapping("/api/mypage")
    public ResponseEntity<MypageResponseDTO> getMyPage(
            @AuthenticationPrincipal Jwt jwt) {
        String email = jwt.getClaimAsString("email");

        MypageResponseDTO responseDTO = myPageService.getMyPage(email);

        return ResponseEntity.ok(responseDTO);
    }

    @GetMapping("/api/mypage/tests")
    public ResponseEntity<List<MypageTestHistoryResponseDTO>> getMyTestHistory(
            @AuthenticationPrincipal Jwt jwt) {
        String email = jwt.getClaimAsString("email");
        List<MypageTestHistoryResponseDTO> response = myPageService.getTestHistory(email);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/api/mypage/points/history")
    public ResponseEntity<List<MypagePointHistoryResponseDTO>> getMypagePointHistory(
            @AuthenticationPrincipal Jwt jwt) {
        String email = jwt.getClaimAsString("email");
        List<MypagePointHistoryResponseDTO> response = myPageService.getPointHistory(email);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/api/mypage/coupons/history")
    public ResponseEntity<List<MypageCouponHistoryResponseDTO>> getMypageCouponHistory(
            @AuthenticationPrincipal Jwt jwt) {
        String email = jwt.getClaimAsString("email");
        List<MypageCouponHistoryResponseDTO> response = myPageService.getCouponUsageHistory(email);

        return ResponseEntity.ok(response);
    }
}
