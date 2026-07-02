package com.flowcheck.repository;

import com.flowcheck.domain.User;
import com.flowcheck.domain.UserCoupon;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface UserCouponRepository extends JpaRepository<UserCoupon, UUID> {

    List<UserCoupon> findByUserAndRemainingChancesGreaterThan(User user, Integer chances);

    @Query("""
        select coalesce(sum(uc.remainingChances), 0)
        from UserCoupon uc
        where uc.user.userId = :userId
    """)
    int sumRemainingChancesByUserId(@Param("userId") UUID userId);

}
