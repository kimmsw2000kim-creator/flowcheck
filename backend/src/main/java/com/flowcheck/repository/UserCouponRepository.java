package com.flowcheck.repository;

import com.flowcheck.domain.User;
import com.flowcheck.domain.UserCoupon;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface UserCouponRepository extends JpaRepository<UserCoupon, UUID> {
    List<UserCoupon> findByUserAndRemainingChancesGreaterThan(User user, Integer chances);
}
