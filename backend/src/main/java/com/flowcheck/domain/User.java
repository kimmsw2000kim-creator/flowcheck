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
        this.status = UserStatus.SUSPENDED;
        this.suspendedUntil = until;
    }

    /**
     * 계정 정지 해제
     */
    public void activateAccount() {
        this.status = UserStatus.ACTIVE;
        this.suspendedUntil = null;
    }
}
