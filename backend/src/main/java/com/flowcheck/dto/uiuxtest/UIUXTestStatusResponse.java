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
    private UUID requestId;
    private String status;
    private String targetUrl;
    private String report;
    private List<Map<String, Object>> steps;
    
    private ScoresDto scores;
    private Map<String, Object> deviceInfo;
    private String videoUrl;
    private List<DefectDto> defects;

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
        private Long id;
        private String category;
        private String selector;
        private String severity;
        private String description;
        private Integer timestampOffset;
    }
}
