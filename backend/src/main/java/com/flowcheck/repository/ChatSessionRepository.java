package com.flowcheck.repository;

import com.flowcheck.domain.ChatSession;
import com.flowcheck.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ChatSessionRepository extends JpaRepository<ChatSession, UUID> {
    List<ChatSession> findByUserOrderByCreatedAtDesc(User user);
    List<ChatSession> findByUserAndIsActiveOrderByCreatedAtDesc(User user, Boolean isActive);
}
