package com.flowcheck.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Entity
@Table(name = "community_posts", schema = "public")
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CommunityPost {

    /*
     * community_posts 테이블의 기본키입니다.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "post_id")
    private Long postId;

    /*
     * 게시글 작성자입니다.
     * users.user_id와 community_posts.user_id를 연결합니다.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /*
     * 사이트 홍보 게시글과 등록된 사이트를 연결합니다.
     *
     * TEST_SHARE와 FREE_BOARD에서는 null이 될 수 있고,
     * SITE_PROMOTION 게시글을 만들 때만 Service에서 필수로 검사합니다.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "site_id")
    private RegisteredSite site;

    /*
     * TEST_SHARE, SITE_PROMOTION, FREE_BOARD 중 하나가 저장됩니다.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 30)
    private PostCategory category;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    /*
     * 사이트 홍보 게시글에서만 사용합니다.
     * 테스트 공유와 자유게시판 게시글에서는 null이 될 수 있습니다.
     */
    @Column(name = "promo_url", columnDefinition = "TEXT")
    private String promoUrl;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    /*
     * 게시글이 처음 저장될 때 작성일과 수정일을 설정합니다.
     */
    @PrePersist
    private void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;
    }

    /*
     * 게시글이 수정될 때 수정일을 갱신합니다.
     */
    @PreUpdate
    private void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    /*
     * 게시글 수정 시 제목과 내용만 변경합니다.
     *
     * 카테고리, 연결 사이트, 테스트 결과와 홍보 URL은
     * 게시글 작성 후 변경할 수 없습니다.
     */
    public void update(
            String title,
            String content
    ) {
        this.title = title;
        this.content = content;
    }
}