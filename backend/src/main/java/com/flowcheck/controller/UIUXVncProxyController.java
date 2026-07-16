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
import java.time.Duration;
import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequiredArgsConstructor
public class UIUXVncProxyController {

    private final UIUXTestService uiuxTestService;

    @Value("${vnc.proxy.connect-timeout-ms:${VNC_PROXY_CONNECT_TIMEOUT_MS:5000}}")
    private long vncProxyConnectTimeoutMs;

    @Value("${vnc.proxy.request-timeout-ms:${VNC_PROXY_REQUEST_TIMEOUT_MS:10000}}")
    private long vncProxyRequestTimeoutMs;

    @Value("${vnc.proxy.retry-count:${VNC_PROXY_RETRY_COUNT:3}}")
    private int vncProxyRetryCount;

    @GetMapping("/api/uiux-tests/{requestId}/vnc/**")
    public ResponseEntity<byte[]> proxyVncAsset(@PathVariable UUID requestId, HttpServletRequest servletRequest) {
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
                    .body(("VNC stream is not ready: " + e.getMessage()).getBytes());
        }
    }

    private void validateEntryRequest(UUID requestId, HttpServletRequest servletRequest) {
        String requestUri = servletRequest.getRequestURI();
        if (!requestUri.endsWith("/vnc.html") && !requestUri.endsWith("/vnc/") && !requestUri.endsWith("/vnc")) {
            return;
        }

        String rawExpiresAt = servletRequest.getParameter("expires");
        String token = servletRequest.getParameter("token");
        if (rawExpiresAt == null || rawExpiresAt.isBlank()) {
            throw new IllegalArgumentException("VNC token expiry is required.");
        }

        uiuxTestService.validateVncAccessToken(requestId, Long.parseLong(rawExpiresAt), token);
    }

    private String extractTargetPath(String requestUri, UUID requestId) {
        String prefix = "/api/uiux-tests/" + requestId + "/vnc";
        String path = requestUri.substring(prefix.length());
        return path.isBlank() || "/".equals(path) ? "/vnc.html" : path;
    }

    private void copyFirstHeader(HttpResponse<byte[]> proxyResponse, HttpHeaders headers, String name) {
        List<String> values = proxyResponse.headers().allValues(name);
        if (!values.isEmpty()) {
            headers.set(name, values.getFirst());
        }
    }

    private HttpResponse<byte[]> sendWithShortRetry(HttpRequest proxyRequest, UUID requestId, String targetPath) throws Exception {
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
        throw lastError != null ? lastError : new IllegalStateException("VNC proxy request failed.");
    }
}
