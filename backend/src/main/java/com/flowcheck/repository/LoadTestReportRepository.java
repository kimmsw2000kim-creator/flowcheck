package com.flowcheck.repository;

import com.flowcheck.domain.LoadTestReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface LoadTestReportRepository extends JpaRepository<LoadTestReport, UUID> {
    Optional<LoadTestReport> findByTestRequestId(UUID requestId);
}
