package com.flowcheck.repository;

import com.flowcheck.domain.CommunityPostLike;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CommunityPostLikeRepository extends JpaRepository<CommunityPostLike, Long> {

    Optional<CommunityPostLike> findByPost_PostIdAndUser_UserId(Long postId, UUID userId);

    boolean existsByPost_PostIdAndUser_UserId(Long postId, UUID userId);

    long countByPost_PostId(Long postId);
}
