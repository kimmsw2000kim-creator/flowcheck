package com.flowcheck.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowcheck.domain.*;
import com.flowcheck.dto.ChatRequestDto;
import com.flowcheck.dto.ChatResponseDto;
import com.flowcheck.repository.ChatMessageRepository;
import com.flowcheck.repository.ChatSessionRepository;
import com.flowcheck.repository.TestRequestRepository;
import com.flowcheck.util.EncryptionUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;
import io.netty.handler.ssl.SslContext;
import io.netty.handler.ssl.SslContextBuilder;
import io.netty.handler.ssl.util.InsecureTrustManagerFactory;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatbotService {

    private final ChatSessionRepository chatSessionRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final TestRequestRepository testRequestRepository;
    private final EncryptionUtil encryptionUtil;
    private final WebClient webClient = createInsecureWebClient();
    private final ObjectMapper objectMapper;

    @Value("${gemini.api-key}")
    private String geminiApiKey;

    private static WebClient createInsecureWebClient() {
        try {
            SslContext sslContext = SslContextBuilder.forClient()
                    .trustManager(InsecureTrustManagerFactory.INSTANCE)
                    .build();
            HttpClient httpClient = HttpClient.create().secure(t -> t.sslContext(sslContext));
            return WebClient.builder().clientConnector(new ReactorClientHttpConnector(httpClient)).build();
        } catch (Exception e) {
            return WebClient.create();
        }
    }

    @Transactional
    public ChatResponseDto sendMessage(User user, ChatRequestDto request) {
        // 1. Get or create session
        ChatSession session;
        if (request.getSessionId() == null) {
            session = chatSessionRepository.save(ChatSession.builder()
                    .user(user)
                    .title("New Chat")
                    .build());
        } else {
            session = chatSessionRepository.findById(request.getSessionId())
                    .orElseThrow(() -> new IllegalArgumentException("Session not found"));
            if (!session.getUser().getUserId().equals(user.getUserId())) {
                throw new IllegalStateException("Unauthorized access to chat session");
            }
        }

        // 2. Load and decrypt previous messages
        List<ChatMessage> previousMessages = chatMessageRepository.findByChatSessionOrderByCreatedAtAsc(session);
        List<Map<String, Object>> contents = new ArrayList<>();
        
        for (ChatMessage msg : previousMessages) {
            String decryptedContent = encryptionUtil.decrypt(msg.getEncryptedContent());
            Map<String, Object> contentMap = new HashMap<>();
            contentMap.put("role", msg.getRole() == ChatRole.USER ? "user" : "model");
            contentMap.put("parts", List.of(Map.of("text", decryptedContent)));
            contents.add(contentMap);
        }

        // 3. Add current user message
        Map<String, Object> userContentMap = new HashMap<>();
        userContentMap.put("role", "user");
        userContentMap.put("parts", List.of(Map.of("text", request.getMessage())));
        contents.add(userContentMap);

        // 4. Load Test History to generate System Prompt
        List<TestRequest> testHistory = testRequestRepository.findByUser_UserIdOrderByCreatedAtDesc(user.getUserId());
        StringBuilder systemInstructionText = new StringBuilder();
        systemInstructionText.append("당신은 Flowcheck(플로우체크) 서비스의 친절하고 전문적인 AI 고객 지원 어시스턴트, 첵첵이입니다.\n");
        systemInstructionText.append("다음은 Flowcheck 서비스의 핵심 기능입니다:\n");
        systemInstructionText.append("1. UI/UX 테스트: AI 에이전트가 사용자가 지정한 웹 사이트를 자동으로 탐색하며 버그, 결함, 사용성 문제 등을 찾아 마크다운 리포트와 녹화 비디오 결과를 제공합니다.\n");
        systemInstructionText.append("2. 부하 테스트(Load Test): 사용자가 원하는 테스트 시나리오를 입력하면 AI가 k6 스크립트를 자동 생성하여 대규모 가상 유저(vusers) 트래픽을 발생시키고, 서버의 안정성과 성능을 검증합니다.\n");
        systemInstructionText.append("3. 기타 기능: 테스트 이용을 위한 쿠폰 결제 시스템, 테스트할 도메인 관리, 사용자 간 정보 공유를 위한 커뮤니티 게시판을 제공합니다.\n\n");
        systemInstructionText.append("사용자의 질문에 위 정보를 바탕으로 명확하고 도움이 되는 답변을 제공하세요.\n");
        systemInstructionText.append("★ 중요 규칙: 사용자의 메시지에 '검색해', '찾아봐', 'search' 등 인터넷 검색을 명시적으로 요구하는 표현이 있다면, 반드시 구글 검색 도구(Google Search Tool)를 사용하여 최신 인터넷 웹 문서를 검색하고 그 결과를 바탕으로 답변하세요.\n");
        systemInstructionText.append("중요: 텍스트가 빽빽해 보이지 않도록 문단을 짧게 나누고, 볼드체(**) 사용을 최소화하여 가독성 높게 답변하세요.\n\n");
        
        systemInstructionText.append("사용자의 최근 테스트 이력은 다음과 같습니다:\n");
        for (TestRequest test : testHistory) {
            systemInstructionText.append(String.format("- 유형: %s, 타겟 URL: %s, 상태: %s, 진행률: %d%%\n", 
                    test.getTestType(), test.getTargetUrl(), test.getTestStatus(), test.getTestProgress()));
        }
        systemInstructionText.append("\n사용자의 이력을 참고하여 맞춤형 답변을 제공하세요.");

        Map<String, Object> systemInstruction = Map.of(
            "parts", List.of(Map.of("text", systemInstructionText.toString()))
        );

        // 5. Prepare Gemini API Request
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("system_instruction", systemInstruction);
        requestBody.put("contents", contents);
        // Add Google Search Tool for web search capability
        requestBody.put("tools", List.of(Map.of("googleSearch", Map.of())));

        // 6. Call Gemini API
        String apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=" + geminiApiKey;
        String geminiResponseText;
        try {
            String responseJson = webClient.post()
                    .uri(apiUrl)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode rootNode = objectMapper.readTree(responseJson);
            geminiResponseText = rootNode.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();
            
            // Set session title dynamically on first message (optional enhancement)
            if (previousMessages.isEmpty()) {
                String title = request.getMessage().substring(0, Math.min(request.getMessage().length(), 30));
                session.changeTitle(title);
            }
        } catch (Exception e) {
            log.error("Gemini API Error", e);
            geminiResponseText = "AI 응답을 가져오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
        }

        // 7. Save user message and bot response
        ChatMessage userMessageEntity = chatMessageRepository.save(ChatMessage.builder()
                .chatSession(session)
                .role(ChatRole.USER)
                .encryptedContent(encryptionUtil.encrypt(request.getMessage()))
                .build());

        ChatMessage botMessageEntity = chatMessageRepository.save(ChatMessage.builder()
                .chatSession(session)
                .role(ChatRole.ASSISTANT)
                .encryptedContent(encryptionUtil.encrypt(geminiResponseText))
                .build());

        // 8. Return response
        return ChatResponseDto.builder()
                .messageId(botMessageEntity.getMessageId())
                .sessionId(session.getSessionId())
                .role(ChatRole.ASSISTANT)
                .content(geminiResponseText)
                .createdAt(botMessageEntity.getCreatedAt())
                .build();
    }

    @Transactional(readOnly = true)
    public List<ChatResponseDto> getSessionMessages(User user, java.util.UUID sessionId) {
        ChatSession session = chatSessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));
        
        if (!session.getUser().getUserId().equals(user.getUserId())) {
            throw new IllegalArgumentException("Unauthorized");
        }

        return chatMessageRepository.findByChatSessionOrderByCreatedAtAsc(session)
                .stream()
                .map(msg -> ChatResponseDto.builder()
                        .messageId(msg.getMessageId())
                        .sessionId(session.getSessionId())
                        .role(msg.getRole())
                        .content(encryptionUtil.decrypt(msg.getEncryptedContent()))
                        .createdAt(msg.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }
}
