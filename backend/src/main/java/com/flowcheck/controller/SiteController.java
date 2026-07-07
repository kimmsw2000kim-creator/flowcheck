package com.flowcheck.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowcheck.dto.SiteRegisterRequestDTO;
import com.flowcheck.dto.SiteResponseDTO;
import com.flowcheck.service.SiteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

@Tag(name = "Registered Sites", description = "등록 웹사이트 및 도메인 소유권 검증 API")
@RestController
@RequestMapping("/api/sites")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:5173", "https://flow-check.duckdns.org"})
public class SiteController {

    private final SiteService siteService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Operation(summary = "새 사이트 등록", description = "검증 대상 웹사이트 도메인을 등록합니다. 소유권 검증 토큰이 발급됩니다.")
    @PostMapping
    public ResponseEntity<SiteResponseDTO> registerSite(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody SiteRegisterRequestDTO requestDTO
    ) {
        String email = extractEmailFromToken(authorization);
        SiteResponseDTO response = siteService.registerSite(email, requestDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "등록 사이트 목록 조회", description = "로그인한 유저가 등록한 웹사이트 목록을 조회합니다.")
    @GetMapping
    public ResponseEntity<List<SiteResponseDTO>> getSites(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        String email = extractEmailFromToken(authorization);
        List<SiteResponseDTO> response = siteService.getSites(email);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "사이트 소유권 검증 실행", description = "메타 태그 또는 텍스트 파일 검증을 통해 사이트의 소유권을 인증합니다.")
    @PostMapping("/{id}/verify")
    public ResponseEntity<SiteResponseDTO> verifySite(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable("id") Long id
    ) {
        String email = extractEmailFromToken(authorization);
        SiteResponseDTO response = siteService.verifySite(email, id);
        return ResponseEntity.ok(response);
    }

    private String extractEmailFromToken(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }

        try {
            String token = authorization.substring(7);
            String[] parts = token.split("\\.");

            String payloadJson = new String(
                    Base64.getUrlDecoder().decode(parts[1]),
                    StandardCharsets.UTF_8
            );

            JsonNode payload = objectMapper.readTree(payloadJson);
            String email = payload.path("email").asText();

            if (email == null || email.isBlank()) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "토큰에서 이메일을 찾을 수 없습니다.");
            }

            return email;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "유효하지 않은 토큰입니다.");
        }
    }
}
