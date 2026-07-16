package com.flowcheck.repository;

import com.flowcheck.domain.Comment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommentRepository
        extends JpaRepository<Comment, Long> {

    List<Comment> findByPostIdOrderByCreatedAtAsc(
            Long postId
    );

    long countByPostId(Long postId);

    void deleteByPostId(Long postId);

    void deleteByParentId(Long parentId);
}