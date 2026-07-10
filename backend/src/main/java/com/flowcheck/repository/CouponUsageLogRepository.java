package com.flowcheck.repository;

import com.flowcheck.domain.CouponUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CouponUsageLogRepository extends JpaRepository<CouponUsageLog, Long> {
    List<CouponUsageLog> findByUser_UserIdOrderByUsedAtDesc(UUID userId);
}
