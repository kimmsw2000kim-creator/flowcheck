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

    // UI/UX 테스트의 최종/진행 리포트 저장 테이블입니다.
    // 진행 중에는 rawLogs만 먼저 쌓일 수 있고, 완료 시 점수/보고서/영상/분석 근거가 같은 row에 채워집니다.
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
    // 점수 계산 근거 전체입니다. Lighthouse/axe 사용 여부, 감점 내역, 메트릭 등을 JSON으로 보관합니다.
    private String scoreBreakdown;

    @Column(name = "evaluation_version")
    private String evaluationVersion;

    @Column(name = "video_url", columnDefinition = "TEXT")
    private String videoUrl;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "device_info", columnDefinition = "jsonb")
    // 워커가 테스트한 브라우저/뷰포트/OS 정보입니다.
    private String deviceInfo;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_logs", nullable = false, columnDefinition = "jsonb")
    // 워커가 단계별로 보낸 진행 로그입니다. 프론트 실행 로그와 VNC URL 검색의 원천 데이터입니다.
    private String rawLogs;

    @NotNull
    @Column(name = "uiux_test_review", nullable = false, columnDefinition = "TEXT")
    // 사용자가 읽는 최종 마크다운 요약 보고서입니다.
    private String uiuxTestReview;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
