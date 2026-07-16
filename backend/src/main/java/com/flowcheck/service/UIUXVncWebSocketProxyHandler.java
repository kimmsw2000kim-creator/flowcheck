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
import org.springframework.web.socket.client.standard.StandardWebSocketClient;

import java.net.URI;
import java.nio.ByteBuffer;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class UIUXVncWebSocketProxyHandler implements WebSocketHandler, SubProtocolCapable {

    private static final String TOMCAT_BINARY_BUFFER_SIZE = "org.apache.tomcat.websocket.binaryBufferSize";
    private static final String TOMCAT_TEXT_BUFFER_SIZE = "org.apache.tomcat.websocket.textBufferSize";
    private static final String VNC_WEBSOCKET_BUFFER_SIZE = "1048576";

    private final UIUXTestService uiuxTestService;
    private final StandardWebSocketClient webSocketClient = createWebSocketClient();
    private final Map<String, WebSocketSession> upstreamSessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession clientSession) throws Exception {
        String rawRequestId = (String) clientSession.getAttributes().get("requestId");
        UUID requestId = UUID.fromString(rawRequestId);
        URI baseUri = uiuxTestService.getLiveVncBaseUri(requestId);
        URI upstreamUri = URI.create("ws://" + baseUri.getHost() + ":" + baseUri.getPort() + "/websockify");
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        String acceptedProtocol = clientSession.getAcceptedProtocol();
        headers.setSecWebSocketProtocol(
                acceptedProtocol != null && !acceptedProtocol.isBlank()
                        ? List.of(acceptedProtocol)
                        : List.of("binary"));

        log.info("VNC_DIAG ws_open requestId={} clientSession={} upstreamHost={} upstreamPort={}",
                requestId, clientSession.getId(), upstreamUri.getHost(), upstreamUri.getPort());
        log.info("Opening VNC websocket proxy. requestId={}, clientSession={}, upstream={}",
                requestId, clientSession.getId(), upstreamUri);

        WebSocketSession upstreamSession = webSocketClient.execute(
                new UpstreamRelayHandler(clientSession, requestId),
                headers,
                upstreamUri
        ).get();
        upstreamSessions.put(clientSession.getId(), upstreamSession);
        log.info("VNC_DIAG ws_connected requestId={} clientSession={} upstreamSession={}",
                requestId, clientSession.getId(), upstreamSession.getId());
        log.info("VNC websocket proxy connected. requestId={}, clientSession={}, upstreamSession={}",
                requestId, clientSession.getId(), upstreamSession.getId());
    }

    @Override
    public void handleMessage(WebSocketSession clientSession, WebSocketMessage<?> message) throws Exception {
        WebSocketSession upstreamSession = upstreamSessions.get(clientSession.getId());
        if (upstreamSession != null && upstreamSession.isOpen()) {
            send(upstreamSession, copyMessage(message));
        } else {
            log.warn("VNC_DIAG ws_drop_message requestId={} clientSession={} reason=upstream_not_open",
                    clientSession.getAttributes().get("requestId"), clientSession.getId());
            log.warn("Dropping VNC client message because upstream is not open. clientSession={}",
                    clientSession.getId());
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        log.warn("VNC_DIAG ws_client_error requestId={} clientSession={}",
                session.getAttributes().get("requestId"), session.getId(), exception);
        log.warn("VNC websocket proxy transport error", exception);
        closePair(session, CloseStatus.SERVER_ERROR);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
        log.info("VNC_DIAG ws_client_closed requestId={} clientSession={} status={}",
                session.getAttributes().get("requestId"), session.getId(), closeStatus);
        log.info("VNC client websocket closed. clientSession={}, status={}", session.getId(), closeStatus);
        closePair(session, closeStatus);
    }

    @Override
    public boolean supportsPartialMessages() {
        return true;
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
            return new TextMessage(textMessage.getPayload(), message.isLast());
        }
        if (message instanceof BinaryMessage binaryMessage) {
            ByteBuffer payload = binaryMessage.getPayload().asReadOnlyBuffer();
            byte[] bytes = new byte[payload.remaining()];
            payload.get(bytes);
            return new BinaryMessage(bytes, message.isLast());
        }
        return message;
    }

    private static StandardWebSocketClient createWebSocketClient() {
        StandardWebSocketClient client = new StandardWebSocketClient();
        Map<String, Object> userProperties = new HashMap<>();
        userProperties.put(TOMCAT_BINARY_BUFFER_SIZE, VNC_WEBSOCKET_BUFFER_SIZE);
        userProperties.put(TOMCAT_TEXT_BUFFER_SIZE, VNC_WEBSOCKET_BUFFER_SIZE);
        client.setUserProperties(userProperties);
        return client;
    }

    private class UpstreamRelayHandler implements WebSocketHandler {
        private final WebSocketSession clientSession;
        private final UUID requestId;

        private UpstreamRelayHandler(WebSocketSession clientSession, UUID requestId) {
            this.clientSession = clientSession;
            this.requestId = requestId;
        }

        @Override
        public void afterConnectionEstablished(WebSocketSession session) {
            log.info("VNC_DIAG ws_upstream_connected requestId={} clientSession={} upstreamSession={}",
                    requestId, clientSession.getId(), session.getId());
            log.info("VNC upstream websocket connected. upstreamSession={}", session.getId());
        }

        @Override
        public void handleMessage(WebSocketSession session, WebSocketMessage<?> message) throws Exception {
            if (clientSession.isOpen()) {
                send(clientSession, copyMessage(message));
            }
        }

        @Override
        public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
            log.warn("VNC_DIAG ws_upstream_error requestId={} clientSession={} upstreamSession={}",
                    requestId, clientSession.getId(), session.getId(), exception);
            log.warn("VNC upstream websocket error", exception);
            if (clientSession.isOpen()) {
                clientSession.close(CloseStatus.SERVER_ERROR);
            }
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
            log.info("VNC_DIAG ws_upstream_closed requestId={} clientSession={} upstreamSession={} status={}",
                    requestId, clientSession.getId(), session.getId(), closeStatus);
            log.info("VNC upstream websocket closed. upstreamSession={}, status={}", session.getId(), closeStatus);
            if (clientSession.isOpen()) {
                clientSession.close(closeStatus);
            }
        }

        @Override
        public boolean supportsPartialMessages() {
            return true;
        }
    }
}
