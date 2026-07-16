package com.flowcheck.domain;

// JPA에서 사용하는 어노테이션 모음
import jakarta.persistence.*;

// Lombok에서 사용하는 어노테이션 모음
import lombok.*;

import java.time.LocalDateTime;

/**
 * 게시글 정보를 저장하는 JPA 엔티티입니다.
 *
 * 이 클래스는 데이터베이스의 post 테이블과 연결됩니다.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Post {

    /**
     * 게시글의 고유 번호입니다.
     *
     * @Id
     * - 이 필드를 테이블의 기본 키, Primary Key로 지정합니다.
     *
     * @GeneratedValue(strategy = GenerationType.IDENTITY)
     * - 게시글이 저장될 때 데이터베이스가 ID를 자동으로 증가시킵니다.
     * - PostgreSQL의 identity 또는 auto increment 방식과 연결됩니다.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 게시글을 작성한 사용자의 Supabase 사용자 ID입니다.
     *
     * Supabase JWT의 subject 값인 jwt.getSubject()를 저장합니다.
     *
     * nullable = false
     * - 데이터베이스에 반드시 값이 존재해야 합니다.
     * - null 값으로 저장할 수 없습니다.
     */
    @Column(nullable = false)
    private String userId;

    /**
     * 게시글을 작성한 사용자의 이메일입니다.
     *
     * Supabase JWT에서 가져온 email 값을 저장합니다.
     *
     * nullable = false
     * - 이메일은 반드시 저장되어야 합니다.
     */
    @Column(nullable = false)
    private String email;

    /**
     * 게시글 제목입니다.
     *
     * nullable = false
     * - 제목은 반드시 입력해야 합니다.
     *
     * length = 100
     * - 데이터베이스에서 제목의 최대 길이를 100자로 제한합니다.
     */
    @Column(nullable = false, length = 100)
    private String title;

    /**
     * 게시글 내용입니다.
     *
     * nullable = false
     * - 게시글 내용은 반드시 입력해야 합니다.
     *
     * columnDefinition = "TEXT"
     * - 일반 VARCHAR보다 긴 문자열을 저장할 수 있도록
     *   데이터베이스의 TEXT 타입으로 생성합니다.
     */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    /**
     * 게시글 작성자의 이메일을 별도로 저장하는 필드입니다.
     *
     * 현재 email 필드와 같은 값을 저장한다면 중복 필드가 될 수 있습니다.
     *
     * 기존 프론트엔드나 DTO에서 writerEmail을 사용하고 있다면 유지할 수 있지만,
     * 그렇지 않다면 email 하나로 통일하는 것이 좋습니다.
     */
    private String writerEmail;

    /**
     * 게시글의 좋아요 개수입니다.
     *
     * @Builder.Default
     * - Lombok의 Builder를 사용해 Post 객체를 생성할 때
     *   likeCount 값을 지정하지 않으면 기본값 0을 사용합니다.
     *
     * @Builder.Default가 없으면 Builder 사용 시
     * 필드에 작성한 기본값이 적용되지 않을 수 있습니다.
     */
    @Builder.Default
    private int likeCount = 0;

    /**
     * 게시글이 처음 작성된 시간입니다.
     *
     * 게시글이 데이터베이스에 처음 저장되기 직전에
     * createTime() 메서드에서 현재 시간으로 설정됩니다.
     */
    private LocalDateTime createdAt;

    /**
     * 게시글이 마지막으로 수정된 시간입니다.
     *
     * 게시글 생성 시 현재 시간으로 설정되고,
     * 수정될 때마다 updateTime() 메서드에서 갱신됩니다.
     */
    private LocalDateTime updatedAt;

    /**
     * 게시글이 데이터베이스에 처음 저장되기 전에 실행됩니다.
     *
     * @PrePersist
     * - INSERT 쿼리가 실행되기 직전에 호출되는 JPA 생명주기 어노테이션입니다.
     *
     * 생성 시간과 수정 시간을 모두 현재 시간으로 설정합니다.
     */
    @PrePersist
    public void createTime() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 게시글이 데이터베이스에서 수정되기 전에 실행됩니다.
     *
     * @PreUpdate
     * - UPDATE 쿼리가 실행되기 직전에 호출되는 JPA 생명주기 어노테이션입니다.
     *
     * 게시글이 수정될 때 updatedAt만 현재 시간으로 변경합니다.
     */
    @PreUpdate
    public void updateTime() {
        this.updatedAt = LocalDateTime.now();
    }
}