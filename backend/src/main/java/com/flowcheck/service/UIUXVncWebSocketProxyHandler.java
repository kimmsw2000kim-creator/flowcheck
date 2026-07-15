package com.flowcheck.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.SubProtocolCapable;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.WebSocketClient;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;

import java.net.URI;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class UIUXVncWebSocketProxyHandler implements WebSocketHandler, SubProtocolCapable {

    private final UIUXTestService uiuxTestService;
    private final WebSocketClient webSocketClient = new StandardWebSocketClient();
    private final Map<String, WebSocketSession> upstreamSessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession clientSession) throws Exception {
        String rawRequestId = (String) clientSession.getAttributes().get("requestId");
        UUID requestId = UUID.fromString(rawRequestId);
        URI baseUri = uiuxTestService.getLiveVncBaseUri(requestId);
        URI upstreamUri = URI.create("ws://" + baseUri.getHost() + ":" + baseUri.getPort() + "/websockify");
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        headers.setSecWebSocketProtocol(List.of("binary"));

        WebSocketSession upstreamSession = webSocketClient.execute(
                new UpstreamRelayHandler(clientSession),
                headers,
                upstreamUri
        ).get();
        upstreamSessions.put(clientSession.getId(), upstreamSession);
    }

    @Override
    public void handleMessage(WebSocketSession clientSession, WebSocketMessage<?> message) throws Exception {
        WebSocketSession upstreamSession = upstreamSessions.get(clientSession.getId());
        if (upstreamSession != null && upstreamSession.isOpen()) {
            send(upstreamSession, copyMessage(message));
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        log.warn("VNC websocket proxy transport error", exception);
        closePair(session, CloseStatus.SERVER_ERROR);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
        closePair(session, closeStatus);
    }

    @Override
    public boolean supportsPartialMessages() {
        return false;
    }

    @Override
    public List<String> getSubProtocols() {
        return List.of("binary", "base64");
    }

    private void closePair(WebSocketSession clientSession, CloseStatus status) throws Exception {
        WebSocketSession upstreamSession = upstreamSessions.remove(clientSession.getId());
        if (upstreamSession != null && upstreamSession.isOpen()) {
            upstreamSession.close(status);
        }
    }

    private void send(WebSocketSession session, WebSocketMessage<?> message) throws Exception {
        synchronized (session) {
            session.sendMessage(message);
        }
    }

    private WebSocketMessage<?> copyMessage(WebSocketMessage<?> message) {
        if (message instanceof TextMessage textMessage) {
            return new TextMessage(textMessage.getPayload());
        }
        if (message instanceof BinaryMessage binaryMessage) {
            ByteBuffer payload = binaryMessage.getPayload().asReadOnlyBuffer();
            byte[] bytes = new byte[payload.remaining()];
            payload.get(bytes);
            return new BinaryMessage(bytes);
        }
        return message;
    }

    private class UpstreamRelayHandler implements WebSocketHandler {
        private final WebSocketSession clientSession;

        private UpstreamRelayHandler(WebSocketSession clientSession) {
            this.clientSession = clientSession;
        }

        @Override
        public void afterConnectionEstablished(WebSocketSession session) {
        }

        @Override
        public void handleMessage(WebSocketSession session, WebSocketMessage<?> message) throws Exception {
            if (clientSession.isOpen()) {
                send(clientSession, copyMessage(message));
            }
        }

        @Override
        public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
            log.warn("VNC upstream websocket error", exception);
            if (clientSession.isOpen()) {
                clientSession.close(CloseStatus.SERVER_ERROR);
            }
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
            if (clientSession.isOpen()) {
                clientSession.close(closeStatus);
            }
        }

        @Override
        public boolean supportsPartialMessages() {
            return false;
        }
    }
}
