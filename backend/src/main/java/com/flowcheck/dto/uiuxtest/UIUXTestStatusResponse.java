package com.flowcheck.dto.uiuxtest;

import lombok.*;
import java.util.UUID;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UIUXTestStatusResponse {
    // 프론트의 실시간 polling 응답 모델입니다.
    // 진행 중에는 steps/liveStream 위주로 채워지고, 완료 후에는 scores/report/defects/videoUrl까지 채워집니다.
    private UUID requestId;
    private String status;
    private String targetUrl;
    private String report;
    private List<Map<String, Object>> steps;
    
    private ScoresDto scores;
    private Map<String, Object> scoreBreakdown;
    private String evaluationVersion;
    private Map<String, Object> deviceInfo;
    private String videoUrl;
    private LiveStreamDto liveStream;
    private List<DefectDto> defects;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ScoresDto {
        // 워커가 계산한 5개 세부 점수와 가중 평균 종합 점수입니다.
        // bestPractices는 JSON 필드명을 프론트 camelCase와 맞추기 위해 그대로 유지합니다.
        private Integer usability;
        private Integer accessibility;
        private Integer efficiency;
        private Integer performance;
        private Integer bestPractices;
        private Integer overall;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LiveStreamDto {
        // VNC 스트림의 준비 상태만 알려주는 DTO입니다.
        // 실제 접근 URL/token은 보안상 /vnc-token API에서 별도로 발급합니다.
        private String status;
        private Boolean enabled;
        private String message;
        private String vncHost;
        private Integer vncPort;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DefectDto {
        // 최종 결함 타임라인 표시용 DTO입니다.
        // timestampOffset은 녹화 영상에서 해당 결함 시점으로 이동하기 위한 초 단위 위치입니다.
        private Long id;
        private String category;
        private String selector;
        private String severity;
        private String description;
        private Integer timestampOffset;
        private String source;
        private String ruleId;
        private Map<String, Object> evidence;
        private String recommendation;
        private String screenshotUrl;
    }
}
