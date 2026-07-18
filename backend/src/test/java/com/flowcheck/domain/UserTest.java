package com.flowcheck.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class UserTest {

    @Test
    @DisplayName("정지 만료 전에는 계정을 활성화하지 않는다")
    void doesNotActivateBeforeSuspensionExpires() {
        OffsetDateTime now = OffsetDateTime.parse("2026-07-19T12:00:00+09:00");
        User user = User.builder()
                .status(UserStatus.SUSPENDED)
                .suspendedUntil(now.plusSeconds(1))
                .build();

        boolean activated = user.activateIfSuspensionExpired(now);

        assertThat(activated).isFalse();
        assertThat(user.getStatus()).isEqualTo(UserStatus.SUSPENDED);
        assertThat(user.getSuspendedUntil()).isEqualTo(now.plusSeconds(1));
    }

    @Test
    @DisplayName("정지 만료 시각부터 계정을 자동 활성화한다")
    void activatesWhenSuspensionExpires() {
        OffsetDateTime now = OffsetDateTime.parse("2026-07-19T12:00:00+09:00");
        User user = User.builder()
                .status(UserStatus.SUSPENDED)
                .suspendedUntil(now)
                .build();

        boolean activated = user.activateIfSuspensionExpired(now);

        assertThat(activated).isTrue();
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(user.getSuspendedUntil()).isNull();
    }

    @Test
    @DisplayName("탈퇴 계정은 정지 만료 처리 대상이 아니다")
    void doesNotActivateWithdrawnAccount() {
        OffsetDateTime now = OffsetDateTime.parse("2026-07-19T12:00:00+09:00");
        User user = User.builder()
                .status(UserStatus.WITHDRAWN)
                .suspendedUntil(now.minusDays(1))
                .build();

        boolean activated = user.activateIfSuspensionExpired(now);

        assertThat(activated).isFalse();
        assertThat(user.getStatus()).isEqualTo(UserStatus.WITHDRAWN);
    }
}
