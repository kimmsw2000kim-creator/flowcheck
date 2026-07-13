package com.flowcheck.repository;

import com.flowcheck.domain.PostLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

public interface PostLikeRepository extends JpaRepository<PostLike, Long> {

    boolean existsByPostIdAndUserEmail(Long postId, String userEmail);

    Optional<PostLike> findByPostIdAndUserEmail(
            Long postId,
            String userEmail
    );

    long countByPostId(Long postId);

    @Transactional
    void deleteByPostId(Long postId);
}