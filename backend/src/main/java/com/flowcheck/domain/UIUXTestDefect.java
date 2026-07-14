package com.flowcheck.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.OffsetDateTime;

@Entity
@Table(name = "uiux_test_defects", schema = "public")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class UIUXTestDefect {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private TestRequest testRequest;

    @Column(name = "category")
    private String category;

    @Column(name = "selector", columnDefinition = "TEXT")
    private String selector;

    @Column(name = "severity")
    private String severity;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "timestamp_offset")
    private Integer timestampOffset;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
