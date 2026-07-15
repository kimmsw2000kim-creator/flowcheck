package com.flowcheck.repository;

import com.flowcheck.domain.CommunityPost;
import com.flowcheck.domain.PostCategory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface CommunityPostRepository
        extends JpaRepository<CommunityPost, Long> {

    /*
     * 선택한 카테고리의 게시글을 조회합니다.
     * 실제 정렬 방식은 Controller에서 전달하는 Pageable이 결정합니다.
     *
     * EntityGraph를 사용해 작성자 정보도 함께 불러옵니다.
     */
    /*
     * 작성자와 연결된 사이트를 게시글과 함께 조회합니다.
     * 응답 DTO를 만들 때 추가 쿼리가 반복되는 것을 방지합니다.
     */
    @EntityGraph(attributePaths = {"user", "site"})
    Page<CommunityPost> findByCategory(
            PostCategory category,
            Pageable pageable
    );

    /*
     * 카테고리 안에서 제목, 내용, 작성자 이메일을 검색합니다.
     */
    @EntityGraph(attributePaths = {"user", "site"})
    @Query("""
            SELECT post
            FROM CommunityPost post
            WHERE post.category = :category
              AND (
                    LOWER(post.title)
                        LIKE LOWER(CONCAT('%', :keyword, '%'))
                 OR LOWER(post.content)
                        LIKE LOWER(CONCAT('%', :keyword, '%'))
                 OR LOWER(post.user.email)
                        LIKE LOWER(CONCAT('%', :keyword, '%'))
              )
            """)
    Page<CommunityPost> searchByCategory(
            @Param("category") PostCategory category,
            @Param("keyword") String keyword,
            Pageable pageable
    );

    /*
     * 게시글 상세 조회에서 작성자 정보도 함께 가져옵니다.
     */
    @EntityGraph(attributePaths = {"user", "site"})
    Optional<CommunityPost> findByPostId(Long postId);

    /*
     * 특정 사용자가 작성한 커뮤니티 게시글을 조회합니다.
     * 나중에 마이페이지의 '내가 작성한 글'에서도 사용할 수 있습니다.
     */
    @EntityGraph(attributePaths = {"user", "site"})
    Page<CommunityPost> findByUser_UserId(
            UUID userId,
            Pageable pageable
    );
}