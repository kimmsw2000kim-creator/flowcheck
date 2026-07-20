package com.flowcheck.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "users", schema = "public")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class User {

    @Id
    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @NotNull
    @Email
    @Size(max = 255)
    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Size(min = 2, max = 20)
    @Column(length = 20)
    private String nickname;

    @NotNull
    @Min(0)
    @Builder.Default
    @ColumnDefault("0")
    @Column(name = "balance", nullable = false)
    private Integer balance = 0;

    @NotNull
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @ColumnDefault("'USER'")
    @Column(nullable = false, length = 20)
    private Role role = Role.USER;

    @NotNull
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @ColumnDefault("'ACTIVE'")
    @Column(nullable = false, length = 20)
    private UserStatus status = UserStatus.ACTIVE;

    @Column(name = "suspended_until")
    private OffsetDateTime suspendedUntil;

    @Column(name = "status_changed_at")
    private OffsetDateTime statusChangedAt;

    @Column(name = "avatar_url", columnDefinition = "TEXT")
    private String avatarUrl;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    /**
     * 크레딧(잔액) 충전
     */
    public void chargeBalance(int amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("충전 금액은 0보다 커야 합니다.");
        }
        this.balance += amount;
    }

    /**
     * 크레딧(잔액) 사용
     */
    public void deductBalance(int amount) {
        if (this.balance < amount) {
            throw new IllegalStateException("잔액이 부족합니다.");
        }
        this.balance -= amount;
    }

    /**
     * 계정 정지 처리
     */
    public void suspendAccount(OffsetDateTime until) {
        if (status != UserStatus.ACTIVE) {
            throw new IllegalStateException("활성 계정만 정지할 수 있습니다.");
        }
        this.status = UserStatus.SUSPENDED;
        this.suspendedUntil = until;
        this.statusChangedAt = OffsetDateTime.now();
    }

    /**
     * 계정 정지 해제
     */
    public void releaseSuspension() {
        if (status != UserStatus.SUSPENDED) {
            throw new IllegalStateException("정지 계정만 정지를 해제할 수 있습니다.");
        }
        this.status = UserStatus.ACTIVE;
        this.suspendedUntil = null;
        this.statusChangedAt = OffsetDateTime.now();
    }

    /**
     * 정지 만료 시 계정을 자동 활성화합니다.
     */
    public boolean activateIfSuspensionExpired(OffsetDateTime now) {
        if (status != UserStatus.SUSPENDED
                || suspendedUntil == null
                || suspendedUntil.isAfter(now)) {
            return false;
        }

        this.status = UserStatus.ACTIVE;
        this.suspendedUntil = null;
        this.statusChangedAt = now;
        return true;
    }

    /**
     * 사용자가 계정을 일시 비활성화합니다.
     */
    public void deactivateAccount() {
        if (status != UserStatus.ACTIVE) {
            throw new IllegalStateException("활성 계정만 비활성화할 수 있습니다.");
        }
        this.status = UserStatus.DEACTIVATED;
        this.statusChangedAt = OffsetDateTime.now();
    }

    /**
     * 사용자가 비활성 계정을 다시 활성화합니다.
     */
    public void reactivateAccount() {
        if (status != UserStatus.DEACTIVATED) {
            throw new IllegalStateException("비활성 계정만 재활성화할 수 있습니다.");
        }
        this.status = UserStatus.ACTIVE;
        this.statusChangedAt = OffsetDateTime.now();
    }

    /**
     * 관리자가 활성 또는 정지 계정을 차단합니다.
     */
    public void blockAccount() {
        if (status != UserStatus.ACTIVE && status != UserStatus.SUSPENDED) {
            throw new IllegalStateException("활성 또는 정지 계정만 차단할 수 있습니다.");
        }
        this.status = UserStatus.BLOCKED;
        this.suspendedUntil = null;
        this.statusChangedAt = OffsetDateTime.now();
    }

    /**
     * 관리자가 차단 계정을 해제합니다.
     */
    public void unblockAccount() {
        if (status != UserStatus.BLOCKED) {
            throw new IllegalStateException("차단 계정만 차단을 해제할 수 있습니다.");
        }
        this.status = UserStatus.ACTIVE;
        this.statusChangedAt = OffsetDateTime.now();
    }

    /*
    user 룰 변경
     */
    public void changeRole(Role newRole) {
        this.role = newRole;
    }

    // 프로필 URL 저장
    public void updateAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public void updateNickname(String nickname) {
        this.nickname = nickname;
    }

    // 실제 회원탈퇴는 개인정보 익명화와 인증 계정 삭제 기능에서만 사용합니다.
    public void withdraw() {
        this.status = UserStatus.WITHDRAWN;
        this.suspendedUntil = null;
        this.statusChangedAt = OffsetDateTime.now();
    }
}
