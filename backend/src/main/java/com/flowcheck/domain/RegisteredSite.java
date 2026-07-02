package com.flowcheck.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.OffsetDateTime;

@Entity
@Table(name = "registered_sites", schema = "public")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class RegisteredSite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "site_id", nullable = false, updatable = false)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @NotNull
    @Column(name = "domain_url", nullable = false, columnDefinition = "TEXT", length = Integer.MAX_VALUE)
    private String domainUrl;

    @NotNull
    @Size(max = 100)
    @Column(name = "verification_token", nullable = false, length = 100)
    private String verificationToken;

    @NotNull
    @Builder.Default
    @ColumnDefault("false")
    @Column(name = "is_verified", nullable = false)
    private Boolean isVerified = false;

    @Column(name = "verified_at")
    private OffsetDateTime verifiedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "service_name", columnDefinition = "TEXT", length = Integer.MAX_VALUE)
    private String serviceName;

    // 사이트 검증 완료 시 사용하면 좋을 듯
    // public void markAsVerified() {
    //        this.isVerified = true;
    //        this.verifiedAt = OffsetDateTime.now();
    //    }
}
