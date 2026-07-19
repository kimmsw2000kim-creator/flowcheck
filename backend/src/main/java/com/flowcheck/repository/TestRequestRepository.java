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

    long countByTestStatusIgnoreCase(String testStatus);

    long countByCreatedAtGreaterThanEqualAndCreatedAtLessThan(
            OffsetDateTime start,
            OffsetDateTime end
    );

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

    /*
     * 테스트 종류와 관계없이 현재 사용자가 소유한 테스트를 조회합니다.
     * 테스트 공유 게시글을 만들 때 소유권 확인에 사용합니다.
     */
    Optional<TestRequest> findByIdAndUser_UserId(
            UUID requestId,
            UUID userId
    );

    /*
     * 게시글에 연결된 테스트 요청을 조회합니다.
     * 게시글 응답의 testRequestId를 만들 때 사용합니다.
     */
    Optional<TestRequest> findByCommunityPost_PostId(Long postId);
}
