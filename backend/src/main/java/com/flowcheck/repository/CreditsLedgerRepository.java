package com.flowcheck.repository;

import com.flowcheck.domain.CreditsLedger;
import com.flowcheck.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CreditsLedgerRepository extends JpaRepository<CreditsLedger, Long> {
    List<CreditsLedger> findByUserOrderByCreatedAtDesc(User user);
}
