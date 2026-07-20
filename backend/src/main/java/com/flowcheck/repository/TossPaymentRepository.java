package com.flowcheck.repository;

import com.flowcheck.domain.TossPayment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TossPaymentRepository extends JpaRepository<TossPayment, Long> {
    Optional<TossPayment> findByOrderId(String orderId);
    Optional<TossPayment> findByPaymentKey(String paymentKey);
    List<TossPayment> findByUser_UserIdOrderByCreatedAtDesc(UUID userId);
}
