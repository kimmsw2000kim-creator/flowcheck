package com.flowcheck.repository;

import com.flowcheck.domain.TossPayment;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TossPaymentRepository extends JpaRepository<TossPayment, Long> {
    Optional<TossPayment> findByOrderId(String orderId);
    Optional<TossPayment> findByPaymentKey(String paymentKey);
    List<TossPayment> findByUser_UserIdOrderByCreatedAtDesc(UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select payment from TossPayment payment where payment.orderId = :orderId")
    Optional<TossPayment> findByOrderIdForUpdate(@Param("orderId") String orderId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select payment from TossPayment payment where payment.paymentId = :paymentId")
    Optional<TossPayment> findByIdForUpdate(@Param("paymentId") Long paymentId);
}
