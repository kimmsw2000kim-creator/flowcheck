package com.flowcheck.controller;

import com.flowcheck.domain.Comment;
import com.flowcheck.domain.Post;
import com.flowcheck.domain.PostLike;
import com.flowcheck.dto.CommentRequest;
import com.flowcheck.dto.CommentResponse;
import com.flowcheck.dto.PostLikeResponse;
import com.flowcheck.dto.PostListResponse;
import com.flowcheck.dto.PostRequest;
import com.flowcheck.repository.CommentRepository;
import com.flowcheck.repository.PostLikeRepository;
import com.flowcheck.repository.PostRepository;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {

        private final PostRepository postRepository;
        private final CommentRepository commentRepository;
        private final PostLikeRepository postLikeRepository;

        /*
         * 게시글 목록
         * 항상 최신 게시글 ID 기준 내림차순으로 정렬합니다.
         */
        @GetMapping
        public Page<PostListResponse> getPosts(
                        @RequestParam(required = false) String keyword,
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

                return posts.map(this::toPostResponse);
        }

        /*
         * 게시글 상세 조회
         */
        @GetMapping("/{postId}")
        public PostListResponse getPost(@PathVariable Long postId) {
                Post post = getPostOrThrow(postId);
                return toPostResponse(post);
        }

        /*
         * 게시글 작성
         * 작성자 정보는 요청값이 아닌 JWT에서만 가져옵니다.
         */
        @PostMapping
        @ResponseStatus(HttpStatus.CREATED)
        public PostListResponse createPost(
                        @RequestBody PostRequest request,
                        @AuthenticationPrincipal Jwt jwt) {

                validatePostRequest(request);

                String email = getRequiredEmail(jwt);
                String userId = getRequiredUserId(jwt);

                Post post = new Post();
                post.setTitle(request.getTitle().trim());
                post.setContent(request.getContent().trim());

                // 작성자 정보는 JWT 값만 사용
                post.setEmail(email);
                post.setWriterEmail(email);
                post.setUserId(userId);

                Post savedPost = postRepository.save(post);

                return toPostResponse(savedPost);
        }

        /*
         * 게시글 좋아요 등록/취소
         * 사용자 이메일은 요청 본문이 아닌 JWT에서 가져옵니다.
         */
        @PostMapping("/{postId}/like")
        public PostLikeResponse toggleLike(
                        @PathVariable Long postId,
                        @AuthenticationPrincipal Jwt jwt) {

                Post post = getPostOrThrow(postId);
                String email = getRequiredEmail(jwt);

                boolean alreadyLiked = postLikeRepository.existsByPostIdAndUserEmail(postId, email);

                boolean liked;
                String message;

                if (alreadyLiked) {
                        PostLike existingLike = postLikeRepository
                                        .findByPostIdAndUserEmail(postId, email)
                                        .orElseThrow(() -> new ResponseStatusException(
                                                        HttpStatus.NOT_FOUND,
                                                        "좋아요 정보를 찾을 수 없습니다."));

                        postLikeRepository.delete(existingLike);

                        liked = false;
                        message = "좋아요가 취소되었습니다.";
                } else {
                        PostLike postLike = new PostLike();
                        postLike.setPostId(postId);
                        postLike.setUserEmail(email);

                        postLikeRepository.save(postLike);

                        liked = true;
                        message = "좋아요가 등록되었습니다.";
                }

                long likeCount = postLikeRepository.countByPostId(postId);

                post.setLikeCount((int) likeCount);
                postRepository.save(post);

                return new PostLikeResponse(
                                postId,
                                likeCount,
                                liked,
                                message);
        }

        /*
         * 현재 로그인 사용자의 좋아요 상태 조회
         */
        @GetMapping("/{postId}/like-status")
        public PostLikeResponse getLikeStatus(
                        @PathVariable Long postId,
                        @AuthenticationPrincipal Jwt jwt) {

                getPostOrThrow(postId);

                String email = getRequiredEmail(jwt);

                boolean liked = postLikeRepository.existsByPostIdAndUserEmail(postId, email);

                long likeCount = postLikeRepository.countByPostId(postId);

                return new PostLikeResponse(
                                postId,
                                likeCount,
                                liked,
                                liked
                                                ? "이미 좋아요를 누른 게시글입니다."
                                                : "좋아요를 누르지 않은 게시글입니다.");
        }

        /*
         * 게시글 댓글 및 답글 조회
         */
        @GetMapping("/{postId}/comments")
        public List<CommentResponse> getComments(@PathVariable Long postId) {
                getPostOrThrow(postId);

                List<Comment> comments = commentRepository.findByPostIdOrderByCreatedAtAsc(postId);

                List<Comment> parents = comments.stream()
                                .filter(comment -> comment.getParentId() == null)
                                .toList();

                return parents.stream()
                                .map(parent -> new CommentResponse(
                                                parent.getId(),
                                                parent.getContent(),
                                                parent.getWriterEmail(),
                                                parent.getCreatedAt(),
                                                parent.getParentId(),
                                                comments.stream()
                                                                .filter(reply -> parent.getId()
                                                                                .equals(reply.getParentId()))
                                                                .map(reply -> new CommentResponse(
                                                                                reply.getId(),
                                                                                reply.getContent(),
                                                                                reply.getWriterEmail(),
                                                                                reply.getCreatedAt(),
                                                                                reply.getParentId(),
                                                                                List.of()))
                                                                .toList()))
                                .toList();
        }

        /*
         * 댓글 또는 답글 작성
         */
        @PostMapping("/{postId}/comments")
        @ResponseStatus(HttpStatus.CREATED)
        public CommentResponse createComment(
                        @PathVariable Long postId,
                        @RequestBody CommentRequest request,
                        @AuthenticationPrincipal Jwt jwt) {

                getPostOrThrow(postId);

                if (request == null ||
                                request.getContent() == null ||
                                request.getContent().isBlank()) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "댓글 내용을 입력해주세요.");
                }

                // 답글일 경우 부모 댓글이 같은 게시글에 속하는지 확인
                if (request.getParentId() != null) {
                        Comment parentComment = commentRepository.findById(request.getParentId())
                                        .orElseThrow(() -> new ResponseStatusException(
                                                        HttpStatus.NOT_FOUND,
                                                        "부모 댓글을 찾을 수 없습니다."));

                        if (!postId.equals(parentComment.getPostId())) {
                                throw new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "다른 게시글의 댓글에는 답글을 작성할 수 없습니다.");
                        }
                }

                String email = getRequiredEmail(jwt);

                Comment comment = new Comment();
                comment.setPostId(postId);
                comment.setParentId(request.getParentId());
                comment.setContent(request.getContent().trim());
                comment.setWriterEmail(email);

                Comment savedComment = commentRepository.save(comment);

                return new CommentResponse(
                                savedComment.getId(),
                                savedComment.getContent(),
                                savedComment.getWriterEmail(),
                                savedComment.getCreatedAt(),
                                savedComment.getParentId(),
                                List.of());
        }

        /*
         * 댓글 삭제
         * 작성자 본인만 삭제할 수 있습니다.
         */
        @DeleteMapping("/comments/{commentId}")
        @ResponseStatus(HttpStatus.NO_CONTENT)
        public void deleteComment(
                        @PathVariable Long commentId,
                        @AuthenticationPrincipal Jwt jwt) {

                Comment comment = commentRepository.findById(commentId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "댓글을 찾을 수 없습니다."));

                String loginEmail = getRequiredEmail(jwt);

                validateOwner(
                                loginEmail,
                                comment.getWriterEmail(),
                                "본인이 작성한 댓글만 삭제할 수 있습니다.");

                commentRepository.delete(comment);
        }

        /*
         * 게시글 삭제
         * 작성자 본인만 삭제할 수 있습니다.
         */
        @Transactional
        @DeleteMapping("/{postId}")
        @ResponseStatus(HttpStatus.NO_CONTENT)
        public void deletePost(
                        @PathVariable Long postId,
                        @AuthenticationPrincipal Jwt jwt) {

                Post post = getPostOrThrow(postId);
                String loginEmail = getRequiredEmail(jwt);

                validateOwner(
                                loginEmail,
                                post.getWriterEmail(),
                                "본인이 작성한 게시글만 삭제할 수 있습니다.");

                commentRepository.deleteByPostId(postId);
                postLikeRepository.deleteByPostId(postId);
                postRepository.delete(post);
        }

        /*
         * 게시글 수정
         * 작성자 본인만 수정할 수 있습니다.
         */
        @PutMapping("/{postId}")
        public PostListResponse updatePost(
                        @PathVariable Long postId,
                        @RequestBody PostRequest request,
                        @AuthenticationPrincipal Jwt jwt) {

                validatePostRequest(request);

                Post post = getPostOrThrow(postId);
                String loginEmail = getRequiredEmail(jwt);

                validateOwner(
                                loginEmail,
                                post.getWriterEmail(),
                                "본인이 작성한 게시글만 수정할 수 있습니다.");

                post.setTitle(request.getTitle().trim());
                post.setContent(request.getContent().trim());

                Post updatedPost = postRepository.save(post);

                return toPostResponse(updatedPost);
        }

        /*
         * 공통 게시글 응답 변환
         */
        private PostListResponse toPostResponse(Post post) {
                return new PostListResponse(
                                post.getId(),
                                post.getTitle(),
                                post.getContent(),
                                post.getWriterEmail(),
                                post.getCreatedAt(),
                                post.getLikeCount(),
                                commentRepository.countByPostId(post.getId()));
        }

        /*
         * 게시글 조회 공통 처리
         */
        private Post getPostOrThrow(Long postId) {
                return postRepository.findById(postId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "게시글을 찾을 수 없습니다."));
        }

        /*
         * JWT 이메일 조회
         */
        private String getRequiredEmail(Jwt jwt) {
                if (jwt == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.UNAUTHORIZED,
                                        "로그인이 필요합니다.");
                }

                String email = jwt.getClaimAsString("email");

                if (email == null || email.isBlank()) {
                        throw new ResponseStatusException(
                                        HttpStatus.UNAUTHORIZED,
                                        "JWT에서 이메일 정보를 확인할 수 없습니다.");
                }

                return email.trim().toLowerCase();
        }

        /*
         * JWT 사용자 ID(sub) 조회
         */
        private String getRequiredUserId(Jwt jwt) {
                if (jwt == null ||
                                jwt.getSubject() == null ||
                                jwt.getSubject().isBlank()) {
                        throw new ResponseStatusException(
                                        HttpStatus.UNAUTHORIZED,
                                        "JWT에서 사용자 ID를 확인할 수 없습니다.");
                }

                return jwt.getSubject();
        }

        /*
         * 게시글 입력값 검사
         */
        private void validatePostRequest(PostRequest request) {
                if (request == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "게시글 정보가 필요합니다.");
                }

                if (request.getTitle() == null || request.getTitle().isBlank()) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "게시글 제목을 입력해주세요.");
                }

                if (request.getContent() == null || request.getContent().isBlank()) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "게시글 내용을 입력해주세요.");
                }
        }

        /*
         * 작성자 본인 확인
         */
        private void validateOwner(
                        String loginEmail,
                        String writerEmail,
                        String message) {

                if (writerEmail == null ||
                                !loginEmail.equalsIgnoreCase(writerEmail.trim())) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        message);
                }
        }
}