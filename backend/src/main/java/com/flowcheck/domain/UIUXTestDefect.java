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

    // UI/UX 테스트 중 발견한 개별 결함입니다.
    // Lighthouse, axe-core, Playwright, 자체 UX 규칙에서 나온 문제를 같은 테이블에 저장해
    // 프론트의 결함 타임라인과 상세 보고서가 동일한 데이터 모델을 사용하게 합니다.
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
    // 녹화 영상 기준 결함 발생 시점(초)입니다. 프론트에서 결함 클릭 시 해당 시간대로 seek합니다.
    private Integer timestampOffset;

    @Column(name = "source")
    // 결함을 만든 엔진 이름입니다. 예: LIGHTHOUSE, AXE, PLAYWRIGHT, UX_RULE.
    private String source;

    @Column(name = "rule_id")
    private String ruleId;

    @Column(name = "evidence", columnDefinition = "jsonb")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    // rule별 원본 근거입니다. DOM selector, axe node, Lighthouse item 등 형태가 달라 JSON으로 보관합니다.
    private String evidence;

    @Column(name = "recommendation", columnDefinition = "TEXT")
    private String recommendation;

    @Column(name = "screenshot_url", columnDefinition = "TEXT")
    private String screenshotUrl;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
