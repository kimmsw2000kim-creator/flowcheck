package com.flowcheck.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.OffsetDateTime;

@Entity
@Table(
        name = "ui_test_steps",
        schema = "public"
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class UiTestStep {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "step_id", nullable = false, updatable = false)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ui_test_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private UiTest uiTest;

    @NotNull
    @Column(name = "step_num", nullable = false)
    private Integer step;

    @NotNull
    @Column(name = "url", nullable = false, columnDefinition = "TEXT")
    private String url;

    @NotNull
    @Column(name = "action", nullable = false, length = 50)
    private String action;

    @Column(name = "selector", columnDefinition = "TEXT")
    private String selector;

    @Column(name = "input_text", columnDefinition = "TEXT")
    private String text;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @Column(name = "error_msg", columnDefinition = "TEXT")
    private String error;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
