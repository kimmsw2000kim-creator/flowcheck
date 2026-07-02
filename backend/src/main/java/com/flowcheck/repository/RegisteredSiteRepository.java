package com.flowcheck.repository;

import com.flowcheck.domain.RegisteredSite;
import com.flowcheck.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RegisteredSiteRepository extends JpaRepository<RegisteredSite, Long> {

    List<RegisteredSite> findByUserOrderByCreatedAtDesc(User user);

    List<RegisteredSite> findByUser_UserIdOrderByCreatedAtDesc(UUID userId);

    long countByUser(User user);

    long countByUser_UserId(UUID userId);
}