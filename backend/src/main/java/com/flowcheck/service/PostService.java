package com.flowcheck.service;

import com.flowcheck.domain.Post;
import com.flowcheck.dto.PostListResponse;
import com.flowcheck.dto.PostRequest;
import com.flowcheck.repository.CommentRepository;
import com.flowcheck.repository.PostLikeRepository;
import com.flowcheck.repository.PostRepository;
import com.flowcheck.repository.UserRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PostService {

    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final PostLikeRepository postLikeRepository;
    private final UserRepository userRepository;

    /**
     * 게시글 목록 조회
     *
     * 게시글 ID가 큰 순서대로 정렬합니다.
     */
    public Page<PostListResponse> getPosts(
            String keyword,
            Pageable pageable) {

        Pageable sortedPageable = PageRequest.of(
                pageable.getPageNumber(),
                pageable.getPageSize(),
                Sort.by(
                        Sort.Direction.DESC,
                        "id"));

        Page<Post> posts;

        if (keyword == null || keyword.isBlank()) {
            posts = postRepository.findAll(
                    sortedPageable);
        } else {
            String trimmedKeyword = keyword.trim();

            posts = postRepository
                    .findByTitleContainingIgnoreCaseOrWriterEmailContainingIgnoreCase(
                            trimmedKeyword,
                            trimmedKeyword,
                            sortedPageable);
        }

        return posts.map(
                this::toPostListResponse);
    }

    /**
     * 게시글 상세 조회
     */
    public PostListResponse getPost(
            Long postId) {

        Post post = findPostById(postId);

        return toPostListResponse(post);
    }

    /**
     * 게시글 작성
     */
    @Transactional
    public PostListResponse createPost(
            PostRequest request,
            String email,
            String userId) {

        validatePostRequest(request);

        String normalizedEmail = normalizeRequiredEmail(email);

        if (userId == null
                || userId.isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "사용자 ID를 확인할 수 없습니다.");
        }

        Post post = new Post();

        post.setTitle(
                request.getTitle().trim());

        post.setContent(
                request.getContent().trim());

        post.setEmail(
                normalizedEmail);

        post.setWriterEmail(
                normalizedEmail);

        post.setUserId(
                userId.trim());

        post.setLikeCount(0);

        Post savedPost = postRepository.save(post);

        return toPostListResponse(
                savedPost);
    }

    /**
     * 게시글 수정
     *
     * 게시글 작성자만 수정할 수 있습니다.
     */
    @Transactional
    public PostListResponse updatePost(
            Long postId,
            PostRequest request,
            String loginEmail) {

        validatePostRequest(request);

        Post post = findPostById(postId);

        validateOwner(
                loginEmail,
                post.getWriterEmail(),
                "본인이 작성한 게시글만 수정할 수 있습니다.");

        post.setTitle(
                request.getTitle().trim());

        post.setContent(
                request.getContent().trim());

        /*
         * JPA 변경 감지로도 저장되지만,
         * 현재 코드 흐름을 명확하게 하기 위해 save를 유지합니다.
         */
        Post updatedPost = postRepository.save(post);

        return toPostListResponse(
                updatedPost);
    }

    /**
     * 게시글 삭제
     *
     * 작성자 또는 관리자가 삭제할 수 있습니다.
     */
    @Transactional
    public void deletePost(
            Long postId,
            String loginEmail,
            boolean isAdmin) {

        Post post = findPostById(postId);

        validateDeletePermission(
                loginEmail,
                post.getWriterEmail(),
                isAdmin);

        /*
         * 게시글을 참조하는 댓글과 좋아요를 먼저 삭제합니다.
         */
        commentRepository.deleteByPostId(
                postId);

        postLikeRepository.deleteByPostId(
                postId);

        postRepository.delete(post);
    }

    /**
     * Post 엔티티를 응답 DTO로 변환합니다.
     */
    private PostListResponse toPostListResponse(
            Post post) {

        long likeCount = postLikeRepository.countByPostId(
                post.getId());

        long commentCount = commentRepository.countByPostId(
                post.getId());

        return new PostListResponse(
                post.getId(),
                post.getTitle(),
                post.getContent(),
                post.getWriterEmail(),
                findWriterAvatarUrl(post),
                post.getCreatedAt(),
                Math.toIntExact(likeCount),
                Math.toIntExact(commentCount));
    }

    // 작성자 프로필 조회
    private String findWriterAvatarUrl(Post post) {
        if (post.getUserId() != null && !post.getUserId().isBlank()) {
            try {
                return userRepository.findById(UUID.fromString(post.getUserId().trim()))
                        .map(user -> user.getAvatarUrl())
                        .orElseGet(() -> findAvatarByEmail(post.getWriterEmail()));
            } catch (IllegalArgumentException ignored) {
                // 기존 게시글의 비 UUID 사용자 ID는 이메일로 보완합니다.
            }
        }

        return findAvatarByEmail(post.getWriterEmail());
    }

    private String findAvatarByEmail(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }

        return userRepository.findByEmail(email.trim())
                .map(user -> user.getAvatarUrl())
                .orElse(null);
    }

    /**
     * 게시글 조회
     */
    private Post findPostById(
            Long postId) {

        if (postId == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "게시글 ID가 필요합니다.");
        }

        return postRepository
                .findById(postId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "게시글을 찾을 수 없습니다."));
    }

    /**
     * 게시글 요청값 검사
     */
    private void validatePostRequest(
            PostRequest request) {

        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "게시글 정보가 필요합니다.");
        }

        if (request.getTitle() == null
                || request.getTitle().isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "게시글 제목을 입력해주세요.");
        }

        if (request.getContent() == null
                || request.getContent().isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "게시글 내용을 입력해주세요.");
        }
    }

    /**
     * 게시글 수정 권한 검사
     *
     * 작성자 본인만 허용합니다.
     */
    private void validateOwner(
            String loginEmail,
            String writerEmail,
            String errorMessage) {

        if (!isSameEmail(
                loginEmail,
                writerEmail)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    errorMessage);
        }
    }

    /**
     * 게시글 삭제 권한 검사
     *
     * 관리자는 작성자와 관계없이 삭제할 수 있습니다.
     * 일반 사용자는 자신이 작성한 게시글만 삭제할 수 있습니다.
     */
    private void validateDeletePermission(
            String loginEmail,
            String writerEmail,
            boolean isAdmin) {

        if (isAdmin) {
            return;
        }

        if (!isSameEmail(
                loginEmail,
                writerEmail)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "작성자 또는 관리자만 게시글을 삭제할 수 있습니다.");
        }
    }

    /**
     * 두 이메일이 같은지 검사합니다.
     */
    private boolean isSameEmail(
            String loginEmail,
            String writerEmail) {

        String normalizedLoginEmail = normalizeRequiredEmail(
                loginEmail);

        String normalizedWriterEmail = normalizeOptionalEmail(
                writerEmail);

        return !normalizedWriterEmail.isBlank()
                && normalizedLoginEmail.equals(
                        normalizedWriterEmail);
    }

    /**
     * 로그인 사용자 이메일 정규화
     *
     * 로그인 이메일은 반드시 존재해야 합니다.
     */
    private String normalizeRequiredEmail(
            String email) {

        if (email == null
                || email.isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "로그인 사용자 이메일을 확인할 수 없습니다.");
        }

        return email
                .trim()
                .toLowerCase(Locale.ROOT);
    }

    /**
     * 게시글 작성자 이메일 정규화
     *
     * 기존 데이터에 작성자 이메일이 없을 수도 있으므로
     * 빈 문자열을 반환합니다.
     */
    private String normalizeOptionalEmail(
            String email) {

        if (email == null
                || email.isBlank()) {
            return "";
        }

        return email
                .trim()
                .toLowerCase(Locale.ROOT);
    }
}
