package com.flowcheck.dto.LoadTest;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class LoadTestMetricsDocumentTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void preservesVersionedJsonbContractDuringRoundTrip() {
        LoadTestMetricsDocument document = new LoadTestMetricsDocument(
                LoadTestMetricsDocument.CURRENT_SCHEMA_VERSION,
                LoadTestMetricsDocument.DEFAULT_BUCKET_SECONDS,
                "MEASURED_K6",
                "COMPLETE",
                null,
                new LoadTestMetricsDocument.Summary(
                        120L,
                        12.0,
                        15,
                        200.0,
                        350.0,
                        1.5),
                92,
                "A",
                "우수",
                new LoadTestMetricsDocument.ScoreBreakdown(56, 36),
                List.of(LoadTestResponse.ChartPoint.builder()
                        .time("00:00")
                        .elapsedSeconds(0)
                        .tps(15)
                        .avgResponse(200.0)
                        .p95Response(350.0)
                        .errorRate(1.5)
                        .vus(10)
                        .build()));

        Map<String, Object> jsonbValue = objectMapper.convertValue(
                document,
                new TypeReference<Map<String, Object>>() {
                });
        LoadTestMetricsDocument restored = objectMapper.convertValue(
                jsonbValue,
                LoadTestMetricsDocument.class);

        assertThat(jsonbValue)
                .containsEntry("schemaVersion", 2)
                .containsEntry("bucketSeconds", 1)
                .containsEntry("dataOrigin", "MEASURED_K6");
        assertThat(restored.summary().totalRequests()).isEqualTo(120L);
        assertThat(restored.summary().maxTps()).isEqualTo(15);
        assertThat(restored.points()).hasSize(1);
        assertThat(restored.points().getFirst().getElapsedSeconds()).isZero();
    }
}
