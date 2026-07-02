package com.flowcheck.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_coupons", schema = "public")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class UserCoupon {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "user_coupon_id", nullable = false, updatable = false)
    private UUID id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "coupon_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Coupon coupon;

    @NotNull
    @Min(0)
    @Column(name = "remaining_chances", nullable = false)
    private Integer remainingChances;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    public void useChance() {
        if (this.remainingChances <= 0) {
            throw new IllegalStateException("해당 쿠폰의 남은 사용 기회가 없습니다.");
        }
        this.remainingChances--;
    }
}
