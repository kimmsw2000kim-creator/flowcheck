package com.flowcheck.controller;

import com.flowcheck.domain.User;
import com.flowcheck.dto.ChatRequestDto;
import com.flowcheck.dto.ChatResponseDto;
import com.flowcheck.dto.ChatSessionDto;
import com.flowcheck.repository.ChatSessionRepository;
import com.flowcheck.repository.UserRepository;
import com.flowcheck.service.ChatbotService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatbotController {

    private final ChatbotService chatbotService;
    private final ChatSessionRepository chatSessionRepository;
    private final UserRepository userRepository; // Assuming UUID authentication is handled via string or similar

    @PostMapping("/send")
    public ResponseEntity<ChatResponseDto> sendMessage(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody ChatRequestDto request) {
        
        UUID userId = UUID.fromString(jwt.getSubject());
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("사용자 정보를 찾을 수 없습니다."));
        ChatResponseDto response = chatbotService.sendMessage(user, request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<ChatSessionDto>> getSessions(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("사용자 정보를 찾을 수 없습니다."));
        List<ChatSessionDto> sessions = chatSessionRepository.findByUserAndIsActiveOrderByCreatedAtDesc(user, true)
                .stream()
                .map(s -> ChatSessionDto.builder()
                        .sessionId(s.getSessionId())
                        .title(s.getTitle())
                        .updatedAt(s.getUpdatedAt())
                        .build())
                .collect(Collectors.toList());
        return ResponseEntity.ok(sessions);
    }

    @GetMapping("/sessions/{sessionId}/messages")
    public ResponseEntity<List<ChatResponseDto>> getSessionMessages(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID sessionId) {
        UUID userId = UUID.fromString(jwt.getSubject());
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("사용자 정보를 찾을 수 없습니다."));
        List<ChatResponseDto> messages = chatbotService.getSessionMessages(user, sessionId);
        return ResponseEntity.ok(messages);
    }
}
