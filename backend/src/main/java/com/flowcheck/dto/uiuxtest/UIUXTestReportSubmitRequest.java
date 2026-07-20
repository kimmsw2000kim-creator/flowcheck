package com.flowcheck.dto.uiuxtest;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UIUXTestReportSubmitRequest {
    // Python UIUX 워커가 테스트 종료 시 Spring 백엔드로 제출하는 최종 결과 payload입니다.
    // 점수/분석 근거/단계 로그/결함/영상 URL이 한 번에 들어오며, 서비스 계층에서 DB 구조에 맞게 분해 저장합니다.
    private String requestId;
    private ScoresDto scores;
    private java.util.Map<String, Object> deviceInfo;
    private String videoUrl;
    
    @com.fasterxml.jackson.annotation.JsonProperty("uiuxTestReview")
    private String uiuxTestReview;
    
    private java.util.List<java.util.Map<String, Object>> steps;

    private java.util.Map<String, Object> scoreBreakdown;
    private String evaluationVersion;

    private java.util.List<DefectDto> defects;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ScoresDto {
        // 최종 점수 스냅샷입니다. scoreBreakdown에는 이 점수가 어떻게 계산됐는지 더 자세한 근거가 들어갑니다.
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
    public static class DefectDto {
        // 워커 내부 UIUXTestDefect 모델과 1:1로 대응되는 제출용 결함 DTO입니다.
        // evidence는 rule별 원본 근거가 달라 Map으로 받습니다.
        private String category;
        private String selector;
        private String severity;
        private String description;
        private Integer timestampOffset;
        private String source;
        private String ruleId;
        private java.util.Map<String, Object> evidence;
        private String recommendation;
        private String screenshotUrl;
    }
}
