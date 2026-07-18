package com.flowcheck.service;

import com.flowcheck.domain.Inquiry;
import com.flowcheck.domain.User;
import com.flowcheck.dto.inquiry.InquiryAnswerRequest;
import com.flowcheck.dto.inquiry.InquiryCreateRequest;
import com.flowcheck.dto.inquiry.InquiryResponse;
import com.flowcheck.repository.InquiryRepository;
import com.flowcheck.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
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

    public List<InquiryResponse> findMine(UUID userId) {
        return inquiryRepository.findByUser_UserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(InquiryResponse::from)
                .toList();
    }

    public List<InquiryResponse> findAll() {
        return inquiryRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(InquiryResponse::from)
                .toList();
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

    private User findUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "사용자를 찾을 수 없습니다."
                ));
    }
}
