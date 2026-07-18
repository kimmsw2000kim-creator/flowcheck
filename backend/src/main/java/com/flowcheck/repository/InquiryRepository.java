package com.flowcheck.repository;

import com.flowcheck.domain.Inquiry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface InquiryRepository extends JpaRepository<Inquiry, Long> {

    List<Inquiry> findByUser_UserIdOrderByCreatedAtDesc(UUID userId);

    List<Inquiry> findAllByOrderByCreatedAtDesc();
}
