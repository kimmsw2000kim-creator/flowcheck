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
public class UIUXTestReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "UIUX_report_id", nullable = false, updatable = false)
    private UUID id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private TestRequest testRequest;

    @Column(name = "score_usability")
    private Integer scoreUsability;

    @Column(name = "score_accessibility")
    private Integer scoreAccessibility;

    @Column(name = "score_efficiency")
    private Integer scoreEfficiency;

    @Column(name = "score_performance")
    private Integer scorePerformance;

    @Column(name = "score_best_practices")
    private Integer scoreBestPractices;

    @Column(name = "overall_score")
    private Integer overallScore;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "score_breakdown", columnDefinition = "jsonb")
    private String scoreBreakdown;

    @Column(name = "evaluation_version")
    private String evaluationVersion;

    @Column(name = "video_url", columnDefinition = "TEXT")
    private String videoUrl;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "device_info", columnDefinition = "jsonb")
    private String deviceInfo;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_logs", nullable = false, columnDefinition = "jsonb")
    private String rawLogs;

    @NotNull
    @Column(name = "uiux_test_review", nullable = false, columnDefinition = "TEXT")
    private String uiuxTestReview;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
