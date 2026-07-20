package com.flowcheck.repository;

import com.flowcheck.domain.CreditsLedger;
import com.flowcheck.domain.CreditTransactionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface CreditsLedgerRepository extends JpaRepository<CreditsLedger, Long> {
    List<CreditsLedger> findByUser_UserIdOrderByCreatedAtDesc(UUID userId);

    List<CreditsLedger> findByTestRequest_IdAndTransactionType(UUID requestId, CreditTransactionType transactionType);

    boolean existsByTestRequest_IdAndTransactionType(UUID requestId, CreditTransactionType transactionType);

    @Query("""
            select coalesce(sum(case when ledger.amount < 0 then -ledger.amount else 0 end), 0)
            from CreditsLedger ledger
            """)
    long sumConsumedCredits();

    @Query("""
            select coalesce(sum(case when ledger.amount < 0 then -ledger.amount else 0 end), 0)
            from CreditsLedger ledger
            where ledger.createdAt >= :start and ledger.createdAt < :end
            """)
    long sumConsumedCreditsBetween(
            @Param("start") OffsetDateTime start,
            @Param("end") OffsetDateTime end
    );
}
