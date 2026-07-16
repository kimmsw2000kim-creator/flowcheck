package com.flowcheck.service;

import com.flowcheck.domain.Post;
import com.flowcheck.dto.PostListResponse;
import com.flowcheck.dto.PostRequest;
import com.flowcheck.repository.CommentRepository;
import com.flowcheck.repository.PostLikeRepository;
import com.flowcheck.repository.PostRepository;

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

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PostService {

    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final PostLikeRepository postLikeRepository;

    /**
     * 게시글 목록 조회
     * 게시글 ID가 큰 순서대로 정렬합니다.
     */
    public Page<PostListResponse> getPosts(
            String keyword,
            Pageable pageable) {

        Pageable sortedPageable = PageRequest.of(
                pageable.getPageNumber(),
                pageable.getPageSize(),
                Sort.by(Sort.Direction.DESC, "id"));

        Page<Post> posts;

        if (keyword == null || keyword.isBlank()) {
            posts = postRepository.findAll(sortedPageable);
        } else {
            String trimmedKeyword = keyword.trim();

            posts = postRepository
                    .findByTitleContainingIgnoreCaseOrWriterEmailContainingIgnoreCase(
                            trimmedKeyword,
                            trimmedKeyword,
                            sortedPageable);
        }

        return posts.map(this::toPostListResponse);
    }

    /**
     * 게시글 상세 조회
     */
    public PostListResponse getPost(Long postId) {
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

        String normalizedEmail = normalizeEmail(email);

        if (userId == null || userId.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "사용자 ID를 확인할 수 없습니다.");
        }

        Post post = new Post();

        post.setTitle(request.getTitle().trim());
        post.setContent(request.getContent().trim());
        post.setEmail(normalizedEmail);
        post.setWriterEmail(normalizedEmail);
        post.setUserId(userId.trim());
        post.setLikeCount(0);

        Post savedPost = postRepository.save(post);

        return toPostListResponse(savedPost);
    }

    /**
     * 게시글 수정
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

        post.setTitle(request.getTitle().trim());
        post.setContent(request.getContent().trim());

        Post updatedPost = postRepository.save(post);

        return toPostListResponse(updatedPost);
    }

    /**
     * 게시글 삭제
     */
    @Transactional
    public void deletePost(
            Long postId,
            String loginEmail) {

        Post post = findPostById(postId);

        validateOwner(
                loginEmail,
                post.getWriterEmail(),
                "본인이 작성한 게시글만 삭제할 수 있습니다.");

        commentRepository.deleteByPostId(postId);
        postLikeRepository.deleteByPostId(postId);

        postRepository.delete(post);
    }

    /**
     * Post Entity를 PostListResponse로 변환합니다.
     */
    private PostListResponse toPostListResponse(Post post) {

        long likeCount = postLikeRepository.countByPostId(post.getId());
        long commentCount = commentRepository.countByPostId(post.getId());

        return new PostListResponse(
                post.getId(),
                post.getTitle(),
                post.getContent(),
                post.getWriterEmail(),
                post.getCreatedAt(),
                Math.toIntExact(likeCount),
                Math.toIntExact(commentCount));
    }

    /**
     * 게시글 조회
     */
    private Post findPostById(Long postId) {

        if (postId == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "게시글 ID가 필요합니다.");
        }

        return postRepository.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "게시글을 찾을 수 없습니다."));
    }

    /**
     * 게시글 요청값 검사
     */
    private void validatePostRequest(PostRequest request) {

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
     * 작성자 본인 확인
     */
    private void validateOwner(
            String loginEmail,
            String writerEmail,
            String errorMessage) {

        String normalizedLoginEmail = normalizeEmail(loginEmail);

        if (writerEmail == null
                || writerEmail.isBlank()
                || !normalizedLoginEmail.equals(normalizeEmail(writerEmail))) {

            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    errorMessage);
        }
    }

    /**
     * 이메일 정규화
     */
    private String normalizeEmail(String email) {

        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "로그인 사용자 이메일을 확인할 수 없습니다.");
        }

        return email
                .trim()
                .toLowerCase(Locale.ROOT);
    }
}