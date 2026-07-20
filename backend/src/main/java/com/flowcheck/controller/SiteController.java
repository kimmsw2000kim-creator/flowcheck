package com.flowcheck.controller;

import com.flowcheck.dto.SiteRegisterRequestDTO;
import com.flowcheck.dto.SiteResponseDTO;
import com.flowcheck.service.SiteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Registered Sites", description = "등록 웹사이트 및 도메인 소유권 검증 API")
@RestController
@RequestMapping("/api/sites")
@RequiredArgsConstructor
@CrossOrigin(origins = {
        "http://localhost:5173",
        "https://flowcheck.kr"
}, allowCredentials = "true")
public class SiteController {

    private final SiteService siteService;

    @Operation(summary = "새 사이트 등록", description = "검증 대상 웹사이트 도메인을 등록합니다. 소유권 검증 토큰이 발급됩니다.")
    @PostMapping
    public ResponseEntity<SiteResponseDTO> registerSite(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody SiteRegisterRequestDTO requestDTO) {
        String email = jwt.getClaimAsString("email");
        SiteResponseDTO response = siteService.registerSite(email, requestDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "등록 사이트 목록 조회", description = "로그인한 유저가 등록한 웹사이트 목록을 조회합니다.")
    @GetMapping
    public ResponseEntity<List<SiteResponseDTO>> getSites(
            @AuthenticationPrincipal Jwt jwt) {
        String email = jwt.getClaimAsString("email");
        List<SiteResponseDTO> response = siteService.getSites(email);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "사이트 소유권 검증 실행", description = "메타 태그 또는 텍스트 파일 검증을 통해 사이트의 소유권을 인증합니다.")
    @PostMapping("/{id}/verify")
    public ResponseEntity<SiteResponseDTO> verifySite(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable("id") Long id) {
        String email = jwt.getClaimAsString("email");
        SiteResponseDTO response = siteService.verifySite(email, id);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "사이트 등록 해제(삭제)", description = "등록된 도메인 사이트를 삭제합니다.")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSite(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable("id") Long id) {
        String email = jwt.getClaimAsString("email");
        siteService.deleteSite(email, id);
        return ResponseEntity.noContent().build();
    }
}
