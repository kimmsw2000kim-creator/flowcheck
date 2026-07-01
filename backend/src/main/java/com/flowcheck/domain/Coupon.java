package com.flowcheck.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

import java.util.UUID;


@Entity
@Table(name = "coupons", schema = "public")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Coupon {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "coupon_id", nullable = false)
    private UUID id;

    @Size(max = 50)
    @NotNull
    @Column(name = "coupon_code", nullable = false, length = 50)
    private String couponCode;

    @NotNull
    @ColumnDefault("1")
    @Column(name = "test_count", nullable = false)
    private Integer testCount;

    @NotNull
    @ColumnDefault("0")
    @Column(name = "credit_price", nullable = false)
    private Integer creditPrice;

    @NotNull
    @ColumnDefault("true")
    @Column(name = "is_active", nullable = false)
    private Boolean isActive;


}