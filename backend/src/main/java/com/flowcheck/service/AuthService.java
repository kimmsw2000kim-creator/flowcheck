package com.flowcheck.service;

import com.flowcheck.config.SupabaseConfig;
import com.flowcheck.domain.User;
import com.flowcheck.dto.AuthResponse;
import com.flowcheck.dto.LoginRequest;
import com.flowcheck.dto.SignupRequest;
import com.flowcheck.repository.UserRepository;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import com.flowcheck.domain.Role;
import com.flowcheck.domain.UserStatus;
import java.time.OffsetDateTime;

import java.util.Map;
import java.util.UUID;

@Service
public class AuthService {

        private final SupabaseConfig supabaseConfig;
        private final RestTemplate restTemplate = new RestTemplate();
        private final UserRepository userRepository;

        public AuthService(SupabaseConfig supabaseConfig, UserRepository userRepository) {
                this.supabaseConfig = supabaseConfig;
                this.userRepository = userRepository;
        }

        public AuthResponse signup(SignupRequest request) {
                String url = supabaseConfig.getSupabaseUrl() + "/auth/v1/signup";

                HttpHeaders headers = createHeaders();

                Map<String, Object> body = Map.of(
                                "email", request.getEmail(),
                                "password", request.getPassword(),
                                "data", Map.of(
                                                "nickname", request.getNickname()));

                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

                ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);
                saveLocalUserIfAbsent(response.getBody(), request.getEmail());

                return new AuthResponse(
                                null,
                                null,
                                request.getEmail(),
                                "회원가입 성공. 이메일 인증을 확인하세요.");
        }

        public AuthResponse login(LoginRequest request) {
                String url = supabaseConfig.getSupabaseUrl()
                                + "/auth/v1/token?grant_type=password";

                HttpHeaders headers = createHeaders();

                Map<String, Object> body = Map.of(
                                "email", request.getEmail(),
                                "password", request.getPassword());

                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

                ResponseEntity<Map> response = restTemplate.exchange(
                                url,
                                HttpMethod.POST,
                                entity,
                                Map.class);

                Map responseBody = response.getBody();

                String accessToken = (String) responseBody.get("access_token");
                String refreshToken = (String) responseBody.get("refresh_token");

                Map user = (Map) responseBody.get("user");
                String email = user != null ? (String) user.get("email") : request.getEmail();

                saveLocalUserIfAbsent(responseBody, email);

                return new AuthResponse(
                                accessToken,
                                refreshToken,
                                email,
                                "로그인 성공");
        }

        private HttpHeaders createHeaders() {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("apikey", supabaseConfig.getAnonKey());
                headers.setBearerAuth(supabaseConfig.getAnonKey());
                return headers;
        }

        private void saveLocalUserIfAbsent(Map responseBody, String fallbackEmail) {
                if (responseBody == null) {
                        throw new IllegalStateException("Supabase signup response is empty.");
                }

                Map user = (Map) responseBody.get("user");

                if (user == null || user.get("id") == null) {
                        throw new IllegalStateException("Supabase signup response does not contain user id.");
                }

                String email = user.get("email") != null
                        ? (String) user.get("email")
                        : fallbackEmail;

                if (userRepository.findByEmail(email).isPresent()) {
                        return;
                }

                User localUser = User.builder()
                        .userId(UUID.fromString((String) user.get("id")))
                        .email(email)
                        .balance(0)
                        .role(Role.USER)
                        .status(UserStatus.ACTIVE)
                        .createdAt(OffsetDateTime.now())
                        .build();

                userRepository.save(localUser);
        }
}