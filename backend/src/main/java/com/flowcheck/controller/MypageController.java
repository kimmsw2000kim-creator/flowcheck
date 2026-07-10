package com.flowcheck.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowcheck.dto.mypage.MypageCouponHistoryResponseDTO;
import com.flowcheck.dto.mypage.MypagePointHistoryResponseDTO;
import com.flowcheck.dto.mypage.MypageResponseDTO;
import com.flowcheck.dto.mypage.MypageTestHistoryResponseDTO;
import com.flowcheck.service.MypageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

@RestController
@RequiredArgsConstructor
public class MypageController {

    private final MypageService myPageService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @GetMapping("/api/mypage")
    public ResponseEntity<MypageResponseDTO> getMyPage(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        String email = extractEmailFromToken(authorization);

        MypageResponseDTO responseDTO = myPageService.getMyPage(email);

        return ResponseEntity.ok(responseDTO);
    }

    @GetMapping("/api/mypage/tests")
    public ResponseEntity<List<MypageTestHistoryResponseDTO>> getMyTestHistory(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        String email = extractEmailFromToken(authorization);
        List<MypageTestHistoryResponseDTO> response = myPageService.getTestHistory(email);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/api/mypage/points/history")
    public ResponseEntity<List<MypagePointHistoryResponseDTO>> getMypagePointHistory(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        String email = extractEmailFromToken(authorization);
        List<MypagePointHistoryResponseDTO> response = myPageService.getPointHistory(email);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/api/mypage/coupons/history")
    public ResponseEntity<List<MypageCouponHistoryResponseDTO>> getMypageCouponHistory (
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        String email = extractEmailFromToken(authorization);
        List<MypageCouponHistoryResponseDTO> response = myPageService.getCouponUsageHistory(email);

        return ResponseEntity.ok(response);
    }

    private String extractEmailFromToken(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }

        try {
            String token = authorization.substring(7);
            String[] parts = token.split("\\.");

            String payloadJson = new String(
                    Base64.getUrlDecoder().decode(parts[1]),
                    StandardCharsets.UTF_8
            );

            JsonNode payload = objectMapper.readTree(payloadJson);
            String email = payload.path("email").asText();

            if (email == null || email.isBlank()) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "토큰에서 이메일을 찾을 수 없습니다.");
            }

            return email;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "유효하지 않은 토큰입니다.");
        }
    }
}
