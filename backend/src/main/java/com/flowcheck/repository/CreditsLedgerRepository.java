package com.flowcheck.repository;

import com.flowcheck.domain.CreditsLedger;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CreditsLedgerRepository extends JpaRepository<CreditsLedger, Long> {
}
