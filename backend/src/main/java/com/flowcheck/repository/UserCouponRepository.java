package com.flowcheck.repository;

import com.flowcheck.domain.User;
import com.flowcheck.domain.UserCoupon;
import com.flowcheck.domain.CouponType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface UserCouponRepository extends JpaRepository<UserCoupon, UUID> {

    List<UserCoupon> findByUserAndCoupon_CouponTypeAndRemainingChancesGreaterThanOrderByCreatedAtAsc(User user, CouponType couponType, Integer chances);

    @Query("""
                select coalesce(sum(uc.remainingChances), 0)
                from UserCoupon uc
                where uc.user.userId = :userId
            """)
    int sumRemainingChancesByUserId(@Param("userId") UUID userId);

    @Query("""
        select coalesce(sum(uc.remainingChances), 0)
        from UserCoupon uc
        where uc.user.userId = :userId and uc.coupon.couponType = :couponType
    """)
    int sumRemainingChancesByUserIdAndCouponType(@Param("userId") UUID userId, @Param("couponType") CouponType couponType);

}
