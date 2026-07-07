package com.flowcheck.repository;

import com.flowcheck.domain.CreditsLedger;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CreditsLedgerRepository extends JpaRepository<CreditsLedger, Long> {
    List<CreditsLedger> findByUser_UserIdOrderByCreatedAtDesc(UUID userId);
}
