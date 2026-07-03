package com.flowcheck.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(
        name = "load_test_reports",
        schema = "public",
        indexes = {
                // 💡 JPA가 인덱스 생성을 인지할 수 있도록 명시합니다.
                // (단, GIN 인덱스 같은 DB 특화 인덱스는 Flyway 등을 통한 관리를 권장합니다)
                @Index(name = "idx_load_reports_raw_json", columnList = "raw_metrics")
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class LoadTestReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "load_report_id", nullable = false, updatable = false)
    private UUID id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "request_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE) // 요청이 삭제되면 결과 리포트도 삭제
    private TestRequest testRequest;

    @NotNull
    @Min(0) // 가상 유저 수는 0 이상이어야 함
    @Column(name = "vusers", nullable = false)
    private Integer vusers;

    @NotNull
    @Column(name = "total_tps", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalTps;

    @NotNull
    @Min(0) // 지연 시간(ms)은 0 이상
    @Column(name = "avg_latency", nullable = false)
    private Integer avgLatency;

    @NotNull
    @Column(name = "error_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal errorRate;

    // 💡 Spring Boot 3 (Hibernate 6)의 JSONB 최적 매핑 방식
    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_metrics", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> rawMetrics;

    /* * 만약 Map 대신 특정 DTO 클래스로 매핑하고 싶다면 아래처럼 사용하셔도 됩니다.
     * @JdbcTypeCode(SqlTypes.JSON)
     * private RawMetricsDto rawMetrics;
     */

    @NotBlank
    @Column(name = "ai_performance_review", nullable = false, columnDefinition = "TEXT")
    private String aiPerformanceReview;


    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

}