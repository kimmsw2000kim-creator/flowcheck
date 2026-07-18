package com.flowcheck.repository;

import com.flowcheck.domain.Comment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {

    List<Comment> findByWriterEmailIgnoreCaseOrderByCreatedAtDesc(String writerEmail);

    List<Comment> findByPostIdOrderByCreatedAtAsc(Long postId);

    Page<Comment> findByPostIdAndParentIdIsNullOrderByCreatedAtAsc(
            Long postId,
            Pageable pageable);

    List<Comment> findByParentIdInOrderByCreatedAtAsc(
            Collection<Long> parentIds);

    int countByPostId(Long postId);

    @Transactional
    void deleteByPostId(Long postId);

    void deleteByParentId(Long parentId);
}
