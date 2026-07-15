package com.flowcheck.repository;

import com.flowcheck.domain.TestRequest;
import com.flowcheck.domain.User;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TestRequestRepository extends JpaRepository<TestRequest, UUID> {

    long countByUser_UserId(UUID userId);

    List<TestRequest> findByUser_UserIdOrderByCreatedAtDesc(UUID userId);

    Optional<TestRequest> findByIdAndUser_UserIdAndTestType(UUID requestId, UUID userId, String testType);

    // 특정 유저의 UI/RUNNING 상태 검사용 메서드
    boolean existsByUserAndTestTypeAndTestStatusIn(User user, String testType, List<String> testStatuses);

    // 제한 개수 및 마이페이지 조회를 위한 정렬 메서드
    List<TestRequest> findByUserAndTestTypeOrderByCreatedAtAsc(User user, String testType);

    List<TestRequest> findByTestTypeAndTestStatusInAndCreatedAtBefore(
            String testType,
            List<String> testStatuses,
            OffsetDateTime createdAt);
}
