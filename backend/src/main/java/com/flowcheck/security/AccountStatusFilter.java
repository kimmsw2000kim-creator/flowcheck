package com.flowcheck.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowcheck.domain.User;
import com.flowcheck.domain.UserStatus;
import com.flowcheck.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RequiredArgsConstructor
public class AccountStatusFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        if (!(SecurityContextHolder.getContext().getAuthentication() instanceof JwtAuthenticationToken authentication)
                || !authentication.isAuthenticated()) {
            filterChain.doFilter(request, response);
            return;
        }

        UUID userId;
        try {
            userId = UUID.fromString(authentication.getToken().getSubject());
        } catch (IllegalArgumentException | NullPointerException exception) {
            writeForbidden(response, "ACCOUNT_INVALID", "유효하지 않은 사용자 계정입니다.");
            return;
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            writeForbidden(response, "ACCOUNT_NOT_FOUND", "FlowCheck에 등록되지 않은 계정입니다.");
            return;
        }

        if (user.getStatus() == UserStatus.WITHDRAWN) {
            writeForbidden(response, "ACCOUNT_WITHDRAWN", "탈퇴 처리된 계정입니다.");
            return;
        }

        if (user.getStatus() == UserStatus.BLOCKED) {
            writeForbidden(response, "ACCOUNT_BLOCKED", "관리자에 의해 차단된 계정입니다.");
            return;
        }

        // 비활성 계정은 본인 재활성화 요청만 허용합니다.
        if (user.getStatus() == UserStatus.DEACTIVATED && !isReactivationRequest(request)) {
            writeForbidden(response, "ACCOUNT_DEACTIVATED", "비활성화된 계정입니다.");
            return;
        }

        // 만료된 정지는 첫 인증 요청에서 즉시 해제합니다.
        if (user.activateIfSuspensionExpired(OffsetDateTime.now())) {
            userRepository.save(user);
        }

        if (user.getStatus() == UserStatus.SUSPENDED) {
            writeForbidden(response, "ACCOUNT_SUSPENDED", "이용이 정지된 계정입니다.");
            return;
        }

        Set<GrantedAuthority> authorities = new LinkedHashSet<>(authentication.getAuthorities());
        authorities.removeIf(authority -> authority.getAuthority().startsWith("ROLE_"));
        authorities.add(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));

        JwtAuthenticationToken dbAuthorizedAuthentication = new JwtAuthenticationToken(
                authentication.getToken(),
                authorities,
                authentication.getName());
        dbAuthorizedAuthentication.setDetails(authentication.getDetails());
        SecurityContextHolder.getContext().setAuthentication(dbAuthorizedAuthentication);

        filterChain.doFilter(request, response);
    }

    private boolean isReactivationRequest(HttpServletRequest request) {
        return "POST".equalsIgnoreCase(request.getMethod())
                && "/api/mypage/account/reactivate".equals(request.getServletPath());
    }

    private void writeForbidden(HttpServletResponse response, String code, String message) throws IOException {
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setCharacterEncoding("UTF-8");
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", OffsetDateTime.now());
        body.put("status", HttpStatus.FORBIDDEN.value());
        body.put("error", HttpStatus.FORBIDDEN.getReasonPhrase());
        body.put("code", code);
        body.put("message", message);

        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
