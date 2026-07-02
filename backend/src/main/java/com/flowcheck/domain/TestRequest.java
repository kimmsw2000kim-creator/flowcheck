package com.flowcheck.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "test_requests", schema = "public")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TestRequest {
    @ManyToOne(fetch = FetchType.LAZY)
    @OnDelete(action = OnDeleteAction.SET_NULL)
    @JoinColumn(name = "site_id")
    private RegisteredSite site;

    @NotNull
    @Builder.Default
    @ColumnDefault("now()")
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    @NotNull
    @Builder.Default
    @ColumnDefault("now()")
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Size(max = 20)
    @NotNull
    @Builder.Default
    @ColumnDefault("'PENDING'")
    @Column(name = "test_status", nullable = false, length = 20)
    private String testStatus = "PENDING";

    @NotNull
    @Column(name = "prompt_input", nullable = false, length = Integer.MAX_VALUE)
    private String promptInput;

    @NotNull
    @Column(name = "target_url", nullable = false, length = Integer.MAX_VALUE)
    private String targetUrl;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "request_id", nullable = false)
    private UUID id;
}
