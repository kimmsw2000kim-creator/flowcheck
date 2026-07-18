package com.flowcheck.controller;

import com.flowcheck.dto.inquiry.InquiryAnswerRequest;
import com.flowcheck.dto.inquiry.InquiryCreateRequest;
import com.flowcheck.dto.inquiry.InquiryResponse;
import com.flowcheck.dto.inquiry.InquiryUpdateRequest;
import com.flowcheck.service.InquiryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class InquiryController {

    private final InquiryService inquiryService;

    @PostMapping("/api/inquiries")
    public ResponseEntity<InquiryResponse> create(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody InquiryCreateRequest request) {
        InquiryResponse response = inquiryService.create(
                UUID.fromString(jwt.getSubject()),
                request
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/api/inquiries")
    public ResponseEntity<Page<InquiryResponse>> findMine(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "") String keyword,
            @PageableDefault(size = 10) Pageable pageable) {
        return ResponseEntity.ok(
                inquiryService.findMine(UUID.fromString(jwt.getSubject()), keyword, pageable)
        );
    }

    @PatchMapping("/api/inquiries/{inquiryId}")
    public ResponseEntity<InquiryResponse> updateMine(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long inquiryId,
            @Valid @RequestBody InquiryUpdateRequest request) {
        return ResponseEntity.ok(inquiryService.updateMine(
                UUID.fromString(jwt.getSubject()),
                inquiryId,
                request
        ));
    }

    @DeleteMapping("/api/inquiries/{inquiryId}")
    public ResponseEntity<Void> deleteMine(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long inquiryId) {
        inquiryService.deleteMine(UUID.fromString(jwt.getSubject()), inquiryId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/admin/inquiries")
    public ResponseEntity<Page<InquiryResponse>> findAll(
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "ALL") String status,
            @PageableDefault(size = 10) Pageable pageable) {
        return ResponseEntity.ok(inquiryService.findAll(keyword, status, pageable));
    }

    @PatchMapping("/api/admin/inquiries/{inquiryId}/answer")
    public ResponseEntity<InquiryResponse> answer(
            @PathVariable Long inquiryId,
            @Valid @RequestBody InquiryAnswerRequest request) {
        return ResponseEntity.ok(inquiryService.answer(inquiryId, request));
    }

    @DeleteMapping("/api/admin/inquiries/{inquiryId}")
    public ResponseEntity<Void> deleteByAdmin(@PathVariable Long inquiryId) {
        inquiryService.deleteByAdmin(inquiryId);
        return ResponseEntity.noContent().build();
    }
}
