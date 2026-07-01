package com.flowcheck.repository;

import com.flowcheck.domain.RegisteredSite;
import com.flowcheck.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RegisteredSiteRepository extends JpaRepository<RegisteredSite, Long> {

    List<RegisteredSite> findbyUserOrderByCreatedAtDesc(User user);

    long countByUser(User user);
}
