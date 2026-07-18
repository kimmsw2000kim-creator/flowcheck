package com.flowcheck.controller;

import com.flowcheck.domain.Role;
import com.flowcheck.domain.User;
import com.flowcheck.repository.UserCouponRepository;
import com.flowcheck.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Tag(name = "Admin - User Management", description = "관리자용 회원 관리 API")
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final UserRepository userRepository;
    private final UserCouponRepository userCouponRepository;

    @Operation(summary = "전체 회원 목록 조회")
    @GetMapping
    public List<UserSummaryResponse> getUsers() {
        return userRepository.findAll().stream()
                .map(user -> UserSummaryResponse.from(
                        user,
                        userCouponRepository.sumRemainingChancesByUserId(user.getUserId())
                ))
                .toList();
    }

    @Operation(summary = "회원 권한 변경")
    @PatchMapping("/{userId}/role")
    public UserSummaryResponse changeRole(@PathVariable UUID userId, @RequestBody ChangeRoleRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));
        user.changeRole(request.role());
        userRepository.save(user);
        return UserSummaryResponse.from(user, userCouponRepository.sumRemainingChancesByUserId(userId));
    }

    @Operation(summary = "회원 정지 처리")
    @PatchMapping("/{userId}/suspend")
    public UserSummaryResponse suspendUser(@PathVariable UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));
        user.suspendAccount(OffsetDateTime.now().plusDays(7));
        userRepository.save(user);
        return UserSummaryResponse.from(user, userCouponRepository.sumRemainingChancesByUserId(userId));
    }

    @Operation(summary = "회원 정지 해제")
    @PatchMapping("/{userId}/activate")
    public UserSummaryResponse activateUser(@PathVariable UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));
        user.releaseSuspension();
        userRepository.save(user);
        return UserSummaryResponse.from(user, userCouponRepository.sumRemainingChancesByUserId(userId));
    }

    @Operation(summary = "회원 계정 차단")
    @PatchMapping("/{userId}/block")
    public UserSummaryResponse blockUser(@PathVariable UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));
        user.blockAccount();
        userRepository.save(user);
        return UserSummaryResponse.from(user, userCouponRepository.sumRemainingChancesByUserId(userId));
    }

    @Operation(summary = "회원 계정 차단 해제")
    @PatchMapping("/{userId}/unblock")
    public UserSummaryResponse unblockUser(@PathVariable UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));
        user.unblockAccount();
        userRepository.save(user);
        return UserSummaryResponse.from(user, userCouponRepository.sumRemainingChancesByUserId(userId));
    }

    record ChangeRoleRequest(Role role) {}

    record UserSummaryResponse(
            UUID userId,
            String email,
            Role role,
            String status,
            Integer balance,
            OffsetDateTime createdAt,
            OffsetDateTime suspendedUntil,
            OffsetDateTime statusChangedAt,
            Integer couponCount
    ) {
        static UserSummaryResponse from(User user, int couponCount) {
            return new UserSummaryResponse(
                    user.getUserId(),
                    user.getEmail(),
                    user.getRole(),
                    user.getStatus().name(),
                    user.getBalance(),
                    user.getCreatedAt(),
                    user.getSuspendedUntil(),
                    user.getStatusChangedAt(),
                    couponCount
            );
        }
    }
}
