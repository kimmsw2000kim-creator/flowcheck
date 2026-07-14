package com.flowcheck.dto.uiuxtest;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UIUXTestReportSubmitRequest {
    private String requestId;
    private ScoresDto scores;
    private java.util.Map<String, Object> deviceInfo;
    private String videoUrl;
    
    @com.fasterxml.jackson.annotation.JsonProperty("uiuxTestReview")
    private String uiuxTestReview;
    
    private java.util.List<java.util.Map<String, Object>> steps;

    private java.util.List<DefectDto> defects;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ScoresDto {
        private Integer usability;
        private Integer accessibility;
        private Integer efficiency;
        private Integer performance;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DefectDto {
        private String category;
        private String selector;
        private String severity;
        private String description;
        private Integer timestampOffset;
    }
}
