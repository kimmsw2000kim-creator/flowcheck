package com.flowcheck.repository;

import com.flowcheck.domain.TestRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface TestRequestRepository extends JpaRepository<TestRequest, UUID> {

    long countByUser_UserId(UUID userId);
}
