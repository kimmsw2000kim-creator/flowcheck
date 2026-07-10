package com.flowcheck.repository;

import com.flowcheck.domain.CouponUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface CouponUsageLogRepository extends JpaRepository<CouponUsageLog, Long> {
    @Query("""
        select log
        from CouponUsageLog log
        where log.user.userId = :userId
        order by log.usedAt desc
    """)
    List<CouponUsageLog> findByUser_UserIdOrderByUsedAtDesc(@Param("userId") UUID userId);

    @Query("""
        select log
        from CouponUsageLog log
        where log.user.email = :email
        order by log.usedAt desc
    """)
    List<CouponUsageLog> findUsageHistoryByUserEmail(@Param("email") String email);
}
