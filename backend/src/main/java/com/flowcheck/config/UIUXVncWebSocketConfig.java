package com.flowcheck.config;

import com.flowcheck.service.UIUXVncWebSocketProxyHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class UIUXVncWebSocketConfig implements WebSocketConfigurer {

    private final UIUXVncWebSocketProxyHandler proxyHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(proxyHandler, "/api/uiux-tests/{requestId}/vnc/websockify")
                .addInterceptors(new RequestIdHandshakeInterceptor())
                .setAllowedOriginPatterns("*");
    }

    private static class RequestIdHandshakeInterceptor implements HandshakeInterceptor {
        @Override
        public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                       WebSocketHandler wsHandler, Map<String, Object> attributes) {
            String path = request.getURI().getPath();
            String prefix = "/api/uiux-tests/";
            int start = path.indexOf(prefix);
            int end = path.indexOf("/vnc/websockify");
            if (start >= 0 && end > start) {
                attributes.put("requestId", path.substring(start + prefix.length(), end));
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
