package com.flowcheck.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "uiux_test_reports", schema = "public")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class UiUxTestReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "uiux_report_id", nullable = false, updatable = false)
    private UUID id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private TestRequest testRequest;

    @NotNull
    @Column(name = "total_steps", nullable = false)
    private Integer totalSteps;

    @NotNull
    @Column(name = "defect_count", nullable = false)
    private Integer defectCount;

    @NotNull
    @Column(name = "execution_time", nullable = false)
    private Integer executionTime;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_logs", nullable = false, columnDefinition = "jsonb")
    private String rawLogs;

    @NotNull
    @Column(name = "ai_ux_review", nullable = false, columnDefinition = "TEXT")
    private String aiUxReview;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}