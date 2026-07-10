package com.flowcheck.repository;

import com.flowcheck.domain.UiUxTestReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UiUxTestReportRepository extends JpaRepository<UiUxTestReport, UUID> {
    Optional<UiUxTestReport> findByTestRequestId(UUID requestId);
}