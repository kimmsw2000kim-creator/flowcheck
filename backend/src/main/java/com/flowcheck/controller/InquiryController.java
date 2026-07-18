package com.flowcheck.controller;

import com.flowcheck.dto.inquiry.InquiryAnswerRequest;
import com.flowcheck.dto.inquiry.InquiryCreateRequest;
import com.flowcheck.dto.inquiry.InquiryResponse;
import com.flowcheck.service.InquiryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
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
    public ResponseEntity<List<InquiryResponse>> findMine(
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(
                inquiryService.findMine(UUID.fromString(jwt.getSubject()))
        );
    }

    @GetMapping("/api/admin/inquiries")
    public ResponseEntity<List<InquiryResponse>> findAll() {
        return ResponseEntity.ok(inquiryService.findAll());
    }

    @PatchMapping("/api/admin/inquiries/{inquiryId}/answer")
    public ResponseEntity<InquiryResponse> answer(
            @PathVariable Long inquiryId,
            @Valid @RequestBody InquiryAnswerRequest request) {
        return ResponseEntity.ok(inquiryService.answer(inquiryId, request));
    }
}
