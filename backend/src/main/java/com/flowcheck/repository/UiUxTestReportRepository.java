package com.flowcheck.repository;

import com.flowcheck.domain.UIUXTestReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UIUXTestReportRepository extends JpaRepository<UIUXTestReport, UUID> {
    Optional<UIUXTestReport> findByTestRequestId(UUID requestId);
}