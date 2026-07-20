package com.flowcheck.config;

import com.flowcheck.service.UIUXTestService;
import com.flowcheck.service.UIUXVncWebSocketProxyHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.web.servlet.server.ServletWebServerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

import java.util.Map;
import java.util.UUID;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class UIUXVncWebSocketConfig implements WebSocketConfigurer {

    // UI/UX 테스트의 실시간 화면은 noVNC WebSocket으로 흐릅니다.
    // 이 설정은 Spring WebSocket endpoint를 열고, handshake 단계에서 signed token을 검증한 뒤
    // UIUXVncWebSocketProxyHandler로 실제 relay를 넘깁니다.
    private static final int VNC_WEBSOCKET_BUFFER_SIZE = 1024 * 1024;

    private final UIUXVncWebSocketProxyHandler proxyHandler;
    private final UIUXTestService uiuxTestService;

    @Bean
    public ServletServerContainerFactoryBean webSocketContainer() {
        // VNC framebuffer update는 일반 채팅 메시지보다 훨씬 클 수 있으므로 Tomcat WebSocket 버퍼를 1MB로 올립니다.
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(VNC_WEBSOCKET_BUFFER_SIZE);
        container.setMaxBinaryMessageBufferSize(VNC_WEBSOCKET_BUFFER_SIZE);
        return container;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // noVNC HTML은 path query로 이 endpoint를 바라봅니다.
        // origin은 프론트 배포/로컬 환경이 바뀔 수 있어 넓게 열고, 실제 접근 제어는 token 검증으로 수행합니다.
        registry.addHandler(proxyHandler, "/api/uiux-tests/{requestId}/vnc-ws")
                .addInterceptors(new RequestIdHandshakeInterceptor(uiuxTestService))
                .setAllowedOriginPatterns("*");
    }

    private static class RequestIdHandshakeInterceptor implements HandshakeInterceptor {
        private final UIUXTestService uiuxTestService;

        private RequestIdHandshakeInterceptor(UIUXTestService uiuxTestService) {
            this.uiuxTestService = uiuxTestService;
        }

        @Override
        public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                       WebSocketHandler wsHandler, Map<String, Object> attributes) {
            // WebSocket은 일반 Spring Security 필터처럼 query token을 자동 검증하지 않으므로 handshake에서 직접 확인합니다.
            // 검증이 통과하면 handler가 upstream 주소를 찾을 수 있도록 requestId를 세션 attribute에 저장합니다.
            String path = request.getURI().getPath();
            String prefix = "/api/uiux-tests/";
            int start = path.indexOf(prefix);
            int end = path.indexOf("/vnc-ws");
            if (start >= 0 && end > start) {
                String rawRequestId = path.substring(start + prefix.length(), end);
                Map<String, String> queryParams = UriComponentsBuilder.fromUri(request.getURI())
                        .build()
                        .getQueryParams()
                        .toSingleValueMap();
                String rawExpiresAt = queryParams.get("expires");
                String token = queryParams.get("token");
                if (rawExpiresAt == null || rawExpiresAt.isBlank()) {
                    return false;
                }

                uiuxTestService.validateVncAccessToken(
                        UUID.fromString(rawRequestId),
                        Long.parseLong(rawExpiresAt),
                        token);
                attributes.put("requestId", rawRequestId);
                return true;
            }
            return false;
        }

        @Override
        public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Exception exception) {
        }
    }
}
