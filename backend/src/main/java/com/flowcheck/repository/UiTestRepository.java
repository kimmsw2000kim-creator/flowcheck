package com.flowcheck.repository;

import com.flowcheck.domain.UiTest;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

import com.flowcheck.domain.User;
import java.util.List;

public interface UiTestRepository extends JpaRepository<UiTest, UUID> {
    List<UiTest> findByUserOrderByCreatedAtAsc(User user);

    long countByUser_UserId(UUID userId);

    List<UiTest> findByUser_UserIdOrderByCreatedAtDesc(UUID userId);

    /** 진행 중(PENDING 또는 RUNNING)인 테스트 존재 여부 확인 */
    boolean existsByUserAndStatusIn(User user, List<String> statuses);
}
