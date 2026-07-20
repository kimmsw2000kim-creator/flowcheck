package com.flowcheck.controller;


import com.flowcheck.dto.mypage.MypageCouponHistoryResponseDTO;
import com.flowcheck.dto.mypage.MypageCommunityActivityResponseDTO;
import com.flowcheck.dto.mypage.MypagePointHistoryResponseDTO;
import com.flowcheck.dto.mypage.MypageResponseDTO;
import com.flowcheck.dto.mypage.MypageTestHistoryResponseDTO;
import com.flowcheck.dto.uiuxtest.UIUXTestStatusResponse;
import com.flowcheck.service.MypageService;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
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

    @PatchMapping("/api/mypage/profile-image")
    public ResponseEntity<ProfileImageResponse> updateProfileImage(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody ProfileImageRequest request) {
        UUID userId = UUID.fromString(jwt.getSubject());
        String avatarUrl = myPageService.updateAvatarUrl(userId, request.avatarUrl());
        return ResponseEntity.ok(new ProfileImageResponse(avatarUrl));
    }

    @GetMapping("/api/public/nicknames/availability")
    public ResponseEntity<NicknameAvailabilityResponse> checkNicknameAvailability(
            @RequestParam String nickname) {
        return ResponseEntity.ok(new NicknameAvailabilityResponse(myPageService.isNicknameAvailable(nickname)));
    }

    @PatchMapping("/api/mypage/nickname")
    public ResponseEntity<NicknameResponse> updateNickname(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody NicknameRequest request) {
        UUID userId = UUID.fromString(jwt.getSubject());
        String nickname = myPageService.updateNickname(userId, request.nickname());
        return ResponseEntity.ok(new NicknameResponse(nickname));
    }

    @PatchMapping("/api/mypage/account/deactivate")
    public ResponseEntity<Void> deactivateMyAccount(
            @AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        myPageService.deactivateAccount(userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/mypage/account/reactivate")
    public ResponseEntity<Void> reactivateMyAccount(
            @AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        myPageService.reactivateAccount(userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/mypage/tests")
    public ResponseEntity<List<MypageTestHistoryResponseDTO>> getMyTestHistory(
            @AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        List<MypageTestHistoryResponseDTO> response = myPageService.getTestHistory(userId);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/api/mypage/tests/uiux/{requestId}")
    public ResponseEntity<UIUXTestStatusResponse> getMyUIUXTestDetail(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID requestId) {
        UUID userId = UUID.fromString(jwt.getSubject());
        UIUXTestStatusResponse response = myPageService.getUIUXTestDetail(userId, requestId);

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

    @GetMapping("/api/mypage/community/activities")
    public ResponseEntity<Page<MypageCommunityActivityResponseDTO>> getMyCommunityActivities(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "ALL") String type,
            @PageableDefault(size = 10) Pageable pageable) {
        UUID userId = UUID.fromString(jwt.getSubject());
        Page<MypageCommunityActivityResponseDTO> response =
                myPageService.getCommunityActivities(userId, type, pageable);

        return ResponseEntity.ok(response);
    }

    public record ProfileImageRequest(String avatarUrl) {}

    public record ProfileImageResponse(String avatarUrl) {}

    public record NicknameRequest(
            @NotBlank(message = "닉네임을 입력해 주세요.")
            @Size(min = 2, max = 20, message = "닉네임은 2~20자로 입력해 주세요.")
            @Pattern(regexp = "^[가-힣A-Za-z0-9_]+$", message = "닉네임은 한글, 영문, 숫자, 밑줄만 사용할 수 있습니다.")
            String nickname) {}

    public record NicknameResponse(String nickname) {}

    public record NicknameAvailabilityResponse(boolean available) {}
}
