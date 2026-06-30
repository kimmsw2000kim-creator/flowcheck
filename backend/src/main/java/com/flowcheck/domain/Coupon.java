package com.flowcheck.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "coupons", schema = "public")
@Getter
@Setter
@NoArgsConstructor
public class Coupon {

    @Id
    @Column(name = "coupon_id", updatable = false, nullable = false)
    private UUID couponId;

    @Column(name = "coupon_code", nullable = false, unique = true, length = 50)
    private String couponCode;

    @Column(name = "test_count", nullable = false)
    private Integer testCount = 1;

    @Column(name = "credit_price", nullable = false)
    private Integer creditPrice = 0;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

}
