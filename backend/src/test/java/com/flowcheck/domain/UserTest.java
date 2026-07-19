package com.flowcheck.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

    @Test
    @DisplayName("사용자가 계정을 비활성화한 뒤 다시 활성화할 수 있다")
    void deactivatesAndReactivatesAccount() {
        User user = User.builder().status(UserStatus.ACTIVE).build();

        user.deactivateAccount();
        assertThat(user.getStatus()).isEqualTo(UserStatus.DEACTIVATED);
        assertThat(user.getStatusChangedAt()).isNotNull();

        user.reactivateAccount();
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
    }

    @Test
    @DisplayName("관리자가 계정을 차단한 뒤 차단을 해제할 수 있다")
    void blocksAndUnblocksAccount() {
        User user = User.builder().status(UserStatus.ACTIVE).build();

        user.blockAccount();
        assertThat(user.getStatus()).isEqualTo(UserStatus.BLOCKED);

        user.unblockAccount();
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
    }

    @Test
    @DisplayName("차단 계정은 사용자 재활성화로 해제할 수 없다")
    void doesNotReactivateBlockedAccount() {
        User user = User.builder().status(UserStatus.BLOCKED).build();

        assertThatThrownBy(user::reactivateAccount)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("비활성 계정만 재활성화할 수 있습니다.");
        assertThat(user.getStatus()).isEqualTo(UserStatus.BLOCKED);
    }

    @Test
    @DisplayName("비활성 계정은 관리자 정지 해제로 활성화할 수 없다")
    void doesNotReleaseSuspensionForDeactivatedAccount() {
        User user = User.builder().status(UserStatus.DEACTIVATED).build();

        assertThatThrownBy(user::releaseSuspension)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("정지 계정만 정지를 해제할 수 있습니다.");
        assertThat(user.getStatus()).isEqualTo(UserStatus.DEACTIVATED);
    }
}
