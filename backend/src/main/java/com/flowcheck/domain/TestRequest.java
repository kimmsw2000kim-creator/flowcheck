package com.flowcheck.domain;

import jakarta.persistence.*;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import org.hibernate.annotations.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "test_requests",
        schema = "public",
        indexes = {
                @Index(name = "idx_test_requests_user", columnList = "user_id")
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class TestRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "request_id", nullable = false, updatable = false)
    private UUID id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "post_id")
    private Post post;

    @ManyToOne(fetch = FetchType.LAZY)
    @OnDelete(action = OnDeleteAction.SET_NULL)
    @JoinColumn(name = "site_id")
    private RegisteredSite site;

    @NotNull
    @Column(name = "target_url", nullable = false, columnDefinition = "TEXT", length = Integer.MAX_VALUE)
    private String targetUrl;

    @NotNull
    @Column(name = "prompt_input", nullable = false, columnDefinition = "TEXT", length = Integer.MAX_VALUE)
    private String promptInput;

    @Size(max = 20)
    @NotNull
    @Builder.Default
    @ColumnDefault("'PENDING'")
    @Column(name = "test_status", nullable = false, length = 20)
    private String testStatus = "PENDING";

//    @NotNull
//    @Builder.Default
//    @Enumerated(EnumType.STRING) // 💡 문자열 상태값은 Enum으로 관리하는 것이 가장 안전합니다.
//    @Column(name = "test_status", nullable = false, length = 20)
//    private TestStatus testStatus = TestStatus.PENDING;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public void changeStatus(String newStatus) {
        this.testStatus = newStatus;
    }
}
