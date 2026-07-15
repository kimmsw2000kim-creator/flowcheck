package com.flowcheck.security;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            CorsConfigurationSource corsConfigurationSource
    ) throws Exception {

        http
                // CORS 설정 적용
                .cors(cors ->
                        cors.configurationSource(corsConfigurationSource)
                )

                // JWT 방식이므로 CSRF 비활성화
                .csrf(AbstractHttpConfigurer::disable)

                // 세션을 생성하지 않는 Stateless 방식
                .sessionManagement(session ->
                        session.sessionCreationPolicy(
                                SessionCreationPolicy.STATELESS
                        )
                )

                // API 접근 권한 설정
                .authorizeHttpRequests(auth -> auth

                        // 브라우저 CORS 사전 요청 허용
                        .requestMatchers(HttpMethod.OPTIONS, "/**")
                        .permitAll()

                        // 서버 상태 확인
                        .requestMatchers("/api/health")
                        .permitAll()

                        // 로그인 및 회원가입 API
                        .requestMatchers(
                                "/api/auth/**",
                                "/auth/**"
                        )
                        .permitAll()

                        // Toss Payments 웹훅
                        .requestMatchers(
                                "/api/billing/webhook",
                                "/api/payment/webhook"
                        )
                        .permitAll()

                        // UI/UX 테스트 결과 전송 API
                        .requestMatchers(
                                "/api/uiux-tests/*/report",
                                "/api/uiux-tests/*/fail",
                                "/api/uiux-tests/*/steps"
                        )
                        .permitAll()

                        // 부하 테스트 진행 상황 전송 API
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/load-tests/*/progress"
                        )
                        .permitAll()

                        // 게시판 조회 API
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/posts/**",
                                "/posts/**"
                        )
                        .permitAll()

                        // Swagger
                        .requestMatchers(
                                "/v3/api-docs/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html"
                        )
                        .permitAll()

                        // 그 외 API는 JWT 인증 필요
                        .anyRequest()
                        .authenticated()
                )

                // Supabase 등의 JWT 검증
                .oauth2ResourceServer(oauth2 ->
                        oauth2.jwt(jwt -> {
                        })
                );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // 접근을 허용할 프론트엔드 주소
        configuration.setAllowedOrigins(List.of(
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "https://flow-check.duckdns.org"
        ));

        // 허용할 HTTP Method
        configuration.setAllowedMethods(List.of(
                "GET",
                "POST",
                "PUT",
                "PATCH",
                "DELETE",
                "OPTIONS"
        ));

        // 프론트엔드가 전송할 수 있는 헤더
        configuration.setAllowedHeaders(List.of(
                "Authorization",
                "Content-Type",
                "Accept",
                "Origin",
                "X-Requested-With"
        ));

        // 프론트엔드에서 읽을 수 있는 응답 헤더
        configuration.setExposedHeaders(List.of(
                "Authorization"
        ));

        // 쿠키 및 인증 정보 허용
        configuration.setAllowCredentials(true);

        // 브라우저 사전 요청 캐시 시간
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration("/**", configuration);

        return source;
    }
}