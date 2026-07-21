package com.flowcheck.controller;

import com.flowcheck.service.UIUXTestService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequiredArgsConstructor
public class UIUXVncProxyController {

    // noVNC 정적 파일(vnc.html, JS, CSS 등)을 실제 컨테이너/Fargate 태스크에서 가져와 브라우저에 전달하는 HTTP 프록시입니다.
    // 사용자는 컨테이너 IP로 직접 접속하지 않고 항상 Spring API 경로를 통해 접근하므로,
    // signed token 검증과 네트워크 접근 제어를 백엔드에서 일관되게 처리할 수 있습니다.
    private final UIUXTestService uiuxTestService;

    @Value("${vnc.proxy.connect-timeout-ms:${VNC_PROXY_CONNECT_TIMEOUT_MS:5000}}")
    private long vncProxyConnectTimeoutMs;

    @Value("${vnc.proxy.request-timeout-ms:${VNC_PROXY_REQUEST_TIMEOUT_MS:10000}}")
    private long vncProxyRequestTimeoutMs;

    @Value("${vnc.proxy.retry-count:${VNC_PROXY_RETRY_COUNT:3}}")
    private int vncProxyRetryCount;

    @GetMapping("/api/uiux-tests/{requestId}/vnc/**")
    public ResponseEntity<byte[]> proxyVncAsset(@PathVariable UUID requestId, HttpServletRequest servletRequest) {
        // 최초 진입 URL은 /vnc/vnc.html이고, 이후 noVNC가 같은 prefix 아래의 JS/CSS/font 자산을 추가로 요청합니다.
        // 이 메서드는 요청 경로를 컨테이너의 noVNC 서버 경로로 변환해 그대로 가져옵니다.
        long startedAt = System.nanoTime();
        String targetPath = null;
        URI targetUri = null;
        try {
            validateEntryRequest(requestId, servletRequest);
            URI baseUri = uiuxTestService.getLiveVncBaseUri(requestId);
            targetPath = extractTargetPath(servletRequest.getRequestURI(), requestId);
            String query = servletRequest.getQueryString();
            targetUri = URI.create(baseUri + targetPath + (query != null ? "?" + query : ""));
            log.info("VNC_DIAG asset_request requestId={} path={} targetHost={} targetPort={}",
                    requestId, targetPath, targetUri.getHost(), targetUri.getPort());

            HttpRequest proxyRequest = HttpRequest.newBuilder(targetUri)
                    .timeout(Duration.ofMillis(vncProxyRequestTimeoutMs))
                    .GET()
                    .header("Accept", servletRequest.getHeader("Accept") != null ? servletRequest.getHeader("Accept") : "*/*")
                    .build();

            HttpResponse<byte[]> proxyResponse = sendWithShortRetry(proxyRequest, requestId, targetPath);
            HttpHeaders headers = new HttpHeaders();
            copyFirstHeader(proxyResponse, headers, "content-type");
            copyFirstHeader(proxyResponse, headers, "cache-control");
            long elapsedMs = Duration.ofNanos(System.nanoTime() - startedAt).toMillis();
            log.info("VNC_DIAG asset_response requestId={} path={} status={} bytes={} elapsedMs={}",
                    requestId, targetPath, proxyResponse.statusCode(), proxyResponse.body().length, elapsedMs);

            return new ResponseEntity<>(proxyResponse.body(), headers, HttpStatus.valueOf(proxyResponse.statusCode()));
        } catch (Exception e) {
            long elapsedMs = Duration.ofNanos(System.nanoTime() - startedAt).toMillis();
            log.warn("VNC_DIAG asset_error requestId={} path={} targetHost={} targetPort={} elapsedMs={}",
                    requestId, targetPath, targetUri != null ? targetUri.getHost() : null,
                    targetUri != null ? targetUri.getPort() : null, elapsedMs, e);
            log.warn("VNC asset proxy failed for request {}", requestId, e);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body("실시간 화면 연결을 준비하고 있습니다. 잠시 후 다시 시도해 주세요."
                            .getBytes(StandardCharsets.UTF_8));
        }
    }

    private void validateEntryRequest(UUID requestId, HttpServletRequest servletRequest) {
        // vnc.html 진입점만 signed token을 직접 검사합니다.
        // vnc.html 안에서 로드되는 내부 asset은 같은 signed URL 진입 이후 브라우저가 이어서 요청하는 파일이므로
        // 별도 토큰 파라미터가 없어도 통과시킵니다.
        String requestUri = servletRequest.getRequestURI();
        if (!requestUri.endsWith("/vnc.html") && !requestUri.endsWith("/vnc/") && !requestUri.endsWith("/vnc")) {
            return;
        }

        String rawExpiresAt = servletRequest.getParameter("expires");
        String token = servletRequest.getParameter("token");
        if (rawExpiresAt == null || rawExpiresAt.isBlank()) {
            throw new IllegalArgumentException("실시간 화면 접근 토큰의 만료 시간이 필요합니다.");
        }

        uiuxTestService.validateVncAccessToken(requestId, Long.parseLong(rawExpiresAt), token);
    }

    private String extractTargetPath(String requestUri, UUID requestId) {
        // Spring proxy prefix를 떼고 noVNC 서버가 이해하는 실제 path로 바꿉니다.
        // /api/uiux-tests/{id}/vnc 또는 /vnc/는 noVNC 기본 HTML인 /vnc.html로 보정합니다.
        String prefix = "/api/uiux-tests/" + requestId + "/vnc";
        String path = requestUri.substring(prefix.length());
        return path.isBlank() || "/".equals(path) ? "/vnc.html" : path;
    }

    private void copyFirstHeader(HttpResponse<byte[]> proxyResponse, HttpHeaders headers, String name) {
        // noVNC asset의 content-type/cache-control을 보존해 브라우저가 JS/CSS를 올바르게 해석하도록 합니다.
        List<String> values = proxyResponse.headers().allValues(name);
        if (!values.isEmpty()) {
            headers.set(name, values.getFirst());
        }
    }

    private HttpResponse<byte[]> sendWithShortRetry(HttpRequest proxyRequest, UUID requestId, String targetPath) throws Exception {
        // 컨테이너가 막 뜬 직후에는 noVNC HTTP 서버가 잠깐 5xx 또는 연결 실패를 낼 수 있습니다.
        // 긴 재시도는 페이지 로딩을 묶어 두므로 짧은 backoff만 적용합니다.
        Exception lastError = null;
        int maxAttempts = Math.max(1, vncProxyRetryCount);
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(vncProxyConnectTimeoutMs))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                HttpResponse<byte[]> response = httpClient.send(proxyRequest, HttpResponse.BodyHandlers.ofByteArray());
                if (response.statusCode() < 500 || attempt == maxAttempts) {
                    return response;
                }
                log.warn("VNC_DIAG asset_retry requestId={} path={} attempt={} maxAttempts={} status={} connectTimeoutMs={} requestTimeoutMs={}",
                        requestId, targetPath, attempt, maxAttempts, response.statusCode(),
                        vncProxyConnectTimeoutMs, vncProxyRequestTimeoutMs);
            } catch (Exception e) {
                lastError = e;
                log.warn("VNC_DIAG asset_retry_error requestId={} path={} attempt={} maxAttempts={} connectTimeoutMs={} requestTimeoutMs={} error={}",
                        requestId, targetPath, attempt, maxAttempts, vncProxyConnectTimeoutMs,
                        vncProxyRequestTimeoutMs, e.toString());
                if (attempt == maxAttempts) {
                    throw e;
                }
            }
            Thread.sleep(250L * attempt);
        }
        throw lastError != null ? lastError : new IllegalStateException("실시간 화면 프록시 요청에 실패했습니다.");
    }
}
