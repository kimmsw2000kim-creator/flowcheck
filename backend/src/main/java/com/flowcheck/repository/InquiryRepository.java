package com.flowcheck.repository;

import com.flowcheck.domain.Inquiry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface InquiryRepository extends JpaRepository<Inquiry, Long> {

    @Query("""
            select inquiry from Inquiry inquiry
            where inquiry.user.userId = :userId
              and (:keyword = ''
                   or lower(inquiry.title) like lower(concat('%', :keyword, '%'))
                   or lower(inquiry.content) like lower(concat('%', :keyword, '%')))
            """)
    Page<Inquiry> searchMine(
            @Param("userId") UUID userId,
            @Param("keyword") String keyword,
            Pageable pageable
    );

    @Query("""
            select inquiry from Inquiry inquiry
            where (:keyword = ''
                   or lower(inquiry.title) like lower(concat('%', :keyword, '%'))
                   or lower(inquiry.content) like lower(concat('%', :keyword, '%'))
                   or lower(inquiry.user.email) like lower(concat('%', :keyword, '%')))
              and (:status = 'ALL' or inquiry.status = :status)
            """)
    Page<Inquiry> searchAll(
            @Param("keyword") String keyword,
            @Param("status") String status,
            Pageable pageable
    );

    Optional<Inquiry> findByInquiryIdAndUser_UserId(Long inquiryId, UUID userId);
}
