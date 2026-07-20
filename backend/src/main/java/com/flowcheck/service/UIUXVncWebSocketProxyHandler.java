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

    // noVNC 브라우저 클라이언트와 컨테이너 내부 websockify 사이를 중계하는 WebSocket 프록시입니다.
    // HTTP asset은 UIUXVncProxyController가 담당하고, 실제 화면 픽셀/키보드/마우스 이벤트 스트림은 이 핸들러가 양방향으로 전달합니다.
    private static final String TOMCAT_BINARY_BUFFER_SIZE = "org.apache.tomcat.websocket.binaryBufferSize";
    private static final String TOMCAT_TEXT_BUFFER_SIZE = "org.apache.tomcat.websocket.textBufferSize";
    private static final String VNC_WEBSOCKET_BUFFER_SIZE = "1048576";

    private final UIUXTestService uiuxTestService;
    private final StandardWebSocketClient webSocketClient = createWebSocketClient();
    private final Map<String, WebSocketSession> upstreamSessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession clientSession) throws Exception {
        // HandshakeInterceptor가 검증한 requestId를 session attribute로 넣어둡니다.
        // requestId로 최신 VNC base URI를 찾은 뒤 컨테이너의 /websockify endpoint에 서버 측 WebSocket을 새로 엽니다.
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
        // 브라우저에서 들어오는 키보드/마우스/프로토콜 메시지를 upstream websockify로 전달합니다.
        // upstream 연결이 아직 없거나 끊어진 경우 메시지를 버리고 진단 로그를 남깁니다.
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
        // 클라이언트와 upstream은 1:1 쌍입니다. 한쪽이 닫히면 다른 쪽도 닫아 세션 누수를 막습니다.
        WebSocketSession upstreamSession = upstreamSessions.remove(clientSession.getId());
        if (upstreamSession != null && upstreamSession.isOpen()) {
            upstreamSession.close(status);
        }
    }

    private void send(WebSocketSession session, WebSocketMessage<?> message) throws Exception {
        // Spring WebSocketSession은 동시 send에 안전하지 않을 수 있어 session 단위로 직렬화합니다.
        // VNC는 binary frame이 빠르게 오가기 때문에 여기서 경쟁 상태를 막는 것이 중요합니다.
        synchronized (session) {
            session.sendMessage(message);
        }
    }

    private WebSocketMessage<?> copyMessage(WebSocketMessage<?> message) {
        // 같은 메시지 객체를 양쪽 세션에서 재사용하지 않도록 payload를 복사합니다.
        // 특히 BinaryMessage의 ByteBuffer position이 바뀌면 다음 relay에서 빈 payload가 될 수 있습니다.
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
        // VNC frame은 일반 텍스트 API보다 크므로 Tomcat 기본 버퍼보다 크게 잡습니다.
        // noVNC가 큰 framebuffer update를 보낼 때 잘리지 않도록 1MB로 맞춥니다.
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
            // upstream websockify가 보내는 화면 업데이트를 브라우저 noVNC 클라이언트로 되돌려 보냅니다.
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
