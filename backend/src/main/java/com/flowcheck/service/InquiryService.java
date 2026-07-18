package com.flowcheck.service;

import com.flowcheck.domain.Inquiry;
import com.flowcheck.domain.User;
import com.flowcheck.dto.inquiry.InquiryAnswerRequest;
import com.flowcheck.dto.inquiry.InquiryCreateRequest;
import com.flowcheck.dto.inquiry.InquiryResponse;
import com.flowcheck.dto.inquiry.InquiryUpdateRequest;
import com.flowcheck.repository.InquiryRepository;
import com.flowcheck.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InquiryService {

    private final InquiryRepository inquiryRepository;
    private final UserRepository userRepository;

    @Transactional
    public InquiryResponse create(UUID userId, InquiryCreateRequest request) {
        User user = findUser(userId);
        Inquiry inquiry = new Inquiry(
                user,
                request.title().trim(),
                request.content().trim()
        );
        return InquiryResponse.from(inquiryRepository.save(inquiry));
    }

    public Page<InquiryResponse> findMine(UUID userId, String keyword, Pageable pageable) {
        return inquiryRepository.searchMine(userId, normalizeKeyword(keyword), normalizePageable(pageable))
                .map(InquiryResponse::from);
    }

    public Page<InquiryResponse> findAll(String keyword, String status, Pageable pageable) {
        return inquiryRepository.searchAll(
                        normalizeKeyword(keyword),
                        normalizeStatus(status),
                        normalizePageable(pageable)
                )
                .map(InquiryResponse::from);
    }

    @Transactional
    public InquiryResponse updateMine(UUID userId, Long inquiryId, InquiryUpdateRequest request) {
        Inquiry inquiry = findMine(userId, inquiryId);
        ensurePending(inquiry, "답변 완료된 문의는 수정할 수 없습니다.");

        // 본인의 답변 대기 문의만 수정합니다.
        inquiry.update(request.title().trim(), request.content().trim());
        return InquiryResponse.from(inquiryRepository.save(inquiry));
    }

    @Transactional
    public void deleteMine(UUID userId, Long inquiryId) {
        Inquiry inquiry = findMine(userId, inquiryId);
        ensurePending(inquiry, "답변 완료된 문의는 삭제할 수 없습니다.");

        inquiryRepository.delete(inquiry);
    }

    @Transactional
    public InquiryResponse answer(Long inquiryId, InquiryAnswerRequest request) {
        Inquiry inquiry = inquiryRepository.findById(inquiryId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "문의를 찾을 수 없습니다."
                ));

        // 답변 상태 갱신
        inquiry.answer(request.answer().trim());
        return InquiryResponse.from(inquiryRepository.save(inquiry));
    }

    @Transactional
    public void deleteByAdmin(Long inquiryId) {
        Inquiry inquiry = findInquiry(inquiryId);
        inquiryRepository.delete(inquiry);
    }

    private Inquiry findMine(UUID userId, Long inquiryId) {
        return inquiryRepository.findByInquiryIdAndUser_UserId(inquiryId, userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "문의를 찾을 수 없습니다."
                ));
    }

    private Inquiry findInquiry(Long inquiryId) {
        return inquiryRepository.findById(inquiryId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "문의를 찾을 수 없습니다."
                ));
    }

    private void ensurePending(Inquiry inquiry, String message) {
        if (!"PENDING".equals(inquiry.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, message);
        }
    }

    private String normalizeKeyword(String keyword) {
        String normalized = keyword == null ? "" : keyword.trim();
        if (normalized.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "검색어는 100자 이하로 입력해 주세요.");
        }
        return normalized;
    }

    private String normalizeStatus(String status) {
        String normalized = status == null ? "ALL" : status.trim().toUpperCase(Locale.ROOT);
        if (!java.util.List.of("ALL", "PENDING", "ANSWERED").contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "문의 상태를 확인해 주세요.");
        }
        return normalized;
    }

    private Pageable normalizePageable(Pageable pageable) {
        int page = Math.max(pageable.getPageNumber(), 0);
        int size = Math.min(Math.max(pageable.getPageSize(), 1), 50);
        return PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    private User findUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "사용자를 찾을 수 없습니다."
                ));
    }
}
