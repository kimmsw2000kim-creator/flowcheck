package com.flowcheck.controller;

import com.flowcheck.service.UIUXTestService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequiredArgsConstructor
public class UIUXVncProxyController {

    private final UIUXTestService uiuxTestService;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    @GetMapping("/api/uiux-tests/{requestId}/vnc/**")
    public ResponseEntity<byte[]> proxyVncAsset(@PathVariable UUID requestId, HttpServletRequest servletRequest) {
        try {
            validateEntryRequest(requestId, servletRequest);
            URI baseUri = uiuxTestService.getLiveVncBaseUri(requestId);
            String targetPath = extractTargetPath(servletRequest.getRequestURI(), requestId);
            String query = servletRequest.getQueryString();
            URI targetUri = URI.create(baseUri + targetPath + (query != null ? "?" + query : ""));

            HttpRequest proxyRequest = HttpRequest.newBuilder(targetUri)
                    .GET()
                    .header("Accept", servletRequest.getHeader("Accept") != null ? servletRequest.getHeader("Accept") : "*/*")
                    .build();

            HttpResponse<byte[]> proxyResponse = httpClient.send(proxyRequest, HttpResponse.BodyHandlers.ofByteArray());
            HttpHeaders headers = new HttpHeaders();
            copyFirstHeader(proxyResponse, headers, "content-type");
            copyFirstHeader(proxyResponse, headers, "cache-control");

            return new ResponseEntity<>(proxyResponse.body(), headers, HttpStatus.valueOf(proxyResponse.statusCode()));
        } catch (Exception e) {
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
}
