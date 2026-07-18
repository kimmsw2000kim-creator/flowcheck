package com.flowcheck.repository;

import com.flowcheck.domain.CommunityPostComment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface CommunityPostCommentRepository extends JpaRepository<CommunityPostComment, Long> {

    @EntityGraph(attributePaths = {"user"})
    Page<CommunityPostComment> findByPost_PostIdAndParentIsNullOrderByCreatedAtAsc(
            Long postId,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"user"})
    List<CommunityPostComment> findByParent_IdInOrderByCreatedAtAsc(Collection<Long> parentIds);

    @EntityGraph(attributePaths = {"post", "user", "parent"})
    List<CommunityPostComment> findByUser_UserIdOrderByCreatedAtDesc(UUID userId);

    long countByPost_PostId(Long postId);
}
