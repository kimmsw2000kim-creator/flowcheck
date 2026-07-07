package com.flowcheck.repository;

import com.flowcheck.domain.TestRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TestRequestRepository extends JpaRepository<TestRequest, UUID> {

    long countByUser_UserId(UUID userId);

    List<TestRequest> findByUser_UserIdOrderByCreatedAtDesc(UUID userId);
}
