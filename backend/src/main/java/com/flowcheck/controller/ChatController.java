package com.flowcheck.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Tag(name = "Chatbot", description = "AI 챗봇 프록시 API")
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final RestClient restClient;

    @Value("${fastapi.url:http://localhost:8000}")
    private String fastApiUrl;

    @Value("${internal.load-test-callback-token}")
    private String fastApiInternalApiKey;

    @Operation(summary = "챗봇 메시지 전달", description = "프론트엔드의 챗봇 요청을 FastAPI 서버로 전달합니다.")
    @PostMapping
    public ResponseEntity<?> chat(@RequestBody Map<String, Object> request) {
        try {
            Map response = restClient.post()
                    .uri(fastApiUrl + "/api/chat")
                    .header("X-Internal-Api-Key", fastApiInternalApiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(Map.class);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("FastAPI 챗봇 호출 중 오류 발생", e);
            return ResponseEntity.status(500).body(Map.of("response", "서버 내부 프록시 오류가 발생했습니다."));
        }
    }
}
