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

    private static final int VNC_WEBSOCKET_BUFFER_SIZE = 1024 * 1024;

    private final UIUXVncWebSocketProxyHandler proxyHandler;
    private final UIUXTestService uiuxTestService;

    @Bean
    public ServletServerContainerFactoryBean webSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(VNC_WEBSOCKET_BUFFER_SIZE);
        container.setMaxBinaryMessageBufferSize(VNC_WEBSOCKET_BUFFER_SIZE);
        return container;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
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
