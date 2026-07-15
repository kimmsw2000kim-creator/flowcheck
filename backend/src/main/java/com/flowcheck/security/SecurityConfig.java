package com.flowcheck.security;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
<<<<<<< HEAD
import org.springframework.security.config.Customizer;
=======
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
>>>>>>> dev
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {

<<<<<<< HEAD
        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http)
                        throws Exception {
=======
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, CorsConfigurationSource corsConfigurationSource) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/health").permitAll()
                .requestMatchers("/api/billing/webhook", "/api/payment/webhook").permitAll() // Toss payments webhook does not require token
                .requestMatchers("/api/uiux-tests/*/report", "/api/uiux-tests/*/fail", "/api/uiux-tests/*/steps").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/load-tests/*/progress").permitAll()
                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> {}));
>>>>>>> dev

                http
                                .csrf(csrf -> csrf.disable())

                                // 아래에서 만든 CORS 설정을 Spring Security에 적용
                                .cors(Customizer.withDefaults())

                                .sessionManagement(session -> session
                                                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                                .authorizeHttpRequests(auth -> auth
                                                // 브라우저의 CORS 사전 요청 허용
                                                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                                                // 게시판 조회가 비로그인 사용자에게도 가능하다면 추가
                                                .requestMatchers(HttpMethod.GET, "/api/posts/**").permitAll()
                                                .requestMatchers(HttpMethod.GET, "/posts/**").permitAll()

                                                // 실제 프로젝트에서 공개해야 하는 경로
                                                .requestMatchers(
                                                                "/api/auth/**",
                                                                "/auth/**",
                                                                "/swagger-ui/**",
                                                                "/v3/api-docs/**")
                                                .permitAll()

                                                .anyRequest().authenticated());

                return http.build();
        }

        @Bean
        public CorsConfigurationSource corsConfigurationSource() {
                CorsConfiguration configuration = new CorsConfiguration();

                configuration.setAllowedOrigins(List.of(
                                "http://localhost:5173",
                                "http://127.0.0.1:5173",
                                "https://flow-check.duckdns.org"));

                configuration.setAllowedMethods(List.of(
                                "GET",
                                "POST",
                                "PUT",
                                "PATCH",
                                "DELETE",
                                "OPTIONS"));

                configuration.setAllowedHeaders(List.of(
                                "Authorization",
                                "Content-Type",
                                "Accept",
                                "Origin",
                                "X-Requested-With"));

                configuration.setExposedHeaders(List.of(
                                "Authorization"));

                configuration.setAllowCredentials(true);
                configuration.setMaxAge(3600L);

                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();

                source.registerCorsConfiguration("/**", configuration);

                return source;
        }
}