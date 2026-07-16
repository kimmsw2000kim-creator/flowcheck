package com.flowcheck.controller;

import java.util.Collection;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.flowcheck.domain.Post;
import com.flowcheck.dto.CommentRequest;
import com.flowcheck.dto.CommentResponse;
import com.flowcheck.dto.PostLikeResponse;
import com.flowcheck.dto.PostListResponse;
import com.flowcheck.dto.PostRequest;
import com.flowcheck.repository.PostRepository;
import com.flowcheck.service.CommentService;
import com.flowcheck.service.PostLikeService;
import com.flowcheck.service.PostService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {

        private final PostService postService;
        private final PostLikeService postLikeService;
        private final CommentService commentService;
        private final PostRepository postRepository;

        /**
         * 게시글 목록 조회
         */
        @GetMapping
        public Page<PostListResponse> getPosts(
                        @RequestParam(required = false) String keyword,
                        Pageable pageable) {

                return postService.getPosts(keyword, pageable);
        }

        /**
         * 게시글 상세 조회
         */
        @GetMapping("/{postId}")
        public PostListResponse getPost(
                        @PathVariable Long postId) {

                return postService.getPost(postId);
        }

        /**
         * 게시글 작성
         *
         * PostRequest에 설정된 제목 100자, 본문 5,000자 제한을 검사합니다.
         */
        @PostMapping
        @ResponseStatus(HttpStatus.CREATED)
        public PostListResponse createPost(
                        @Valid @RequestBody PostRequest request,
                        @AuthenticationPrincipal Jwt jwt) {

                String email = getRequiredEmail(jwt);
                String userId = getRequiredUserId(jwt);

                Post post = new Post();
                post.setTitle(request.getTitle().trim());
                post.setContent(request.getContent().trim());
                post.setEmail(email);
                post.setWriterEmail(email);
                post.setUserId(userId);

                Post savedPost = postRepository.save(post);

                return new PostListResponse(
                                savedPost.getId(),
                                savedPost.getTitle(),
                                savedPost.getContent(),
                                savedPost.getWriterEmail(),
                                savedPost.getCreatedAt(),
                                savedPost.getLikeCount(),
                                0);
        }

        /**
         * 게시글 수정
         *
         * 작성자만 수정할 수 있습니다.
         * 수정할 때도 제목과 본문의 글자 수를 검사합니다.
         */
        @PutMapping("/{postId}")
        public PostListResponse updatePost(
                        @PathVariable Long postId,
                        @Valid @RequestBody PostRequest request,
                        @AuthenticationPrincipal Jwt jwt) {

                String email = getRequiredEmail(jwt);

                return postService.updatePost(
                                postId,
                                request,
                                email);
        }

        /**
         * 게시글 삭제
         *
         * 작성자 또는 관리자만 삭제할 수 있습니다.
         */
        @DeleteMapping("/{postId}")
        @ResponseStatus(HttpStatus.NO_CONTENT)
        public void deletePost(
                        @PathVariable Long postId,
                        @AuthenticationPrincipal Jwt jwt) {

                String email = getRequiredEmail(jwt);
                boolean admin = isAdmin(jwt);

                postService.deletePost(
                                postId,
                                email,
                                admin);
        }

        /**
         * 게시글 좋아요 등록 또는 취소
         */
        @PostMapping("/{postId}/like")
        public PostLikeResponse toggleLike(
                        @PathVariable Long postId,
                        @AuthenticationPrincipal Jwt jwt) {

                String email = getRequiredEmail(jwt);

                return postLikeService.toggleLike(
                                postId,
                                email);
        }

        /**
         * 현재 사용자의 좋아요 상태 조회
         */
        @GetMapping("/{postId}/like-status")
        public PostLikeResponse getLikeStatus(
                        @PathVariable Long postId,
                        @AuthenticationPrincipal Jwt jwt) {

                String email = getRequiredEmail(jwt);

                return postLikeService.getLikeStatus(
                                postId,
                                email);
        }

        /**
         * 댓글 및 대댓글 조회
         */
        @GetMapping("/{postId}/comments")
        public List<CommentResponse> getComments(
                        @PathVariable Long postId) {

                return commentService.getComments(postId);
        }

        /**
         * 댓글 또는 대댓글 작성
         *
         * CommentRequest에 설정된 500자 제한을 검사합니다.
         * parentId가 null이면 댓글이고, 값이 있으면 대댓글입니다.
         */
        @PostMapping("/{postId}/comments")
        @ResponseStatus(HttpStatus.CREATED)
        public CommentResponse createComment(
                        @PathVariable Long postId,
                        @Valid @RequestBody CommentRequest request,
                        @AuthenticationPrincipal Jwt jwt) {

                String email = getRequiredEmail(jwt);

                return commentService.createComment(
                                postId,
                                request,
                                email);
        }

        /**
         * 댓글 또는 대댓글 삭제
         *
         * 댓글 또는 대댓글 작성자만 삭제할 수 있습니다.
         */
        @DeleteMapping("/comments/{commentId}")
        @ResponseStatus(HttpStatus.NO_CONTENT)
        public void deleteComment(
                        @PathVariable Long commentId,
                        @AuthenticationPrincipal Jwt jwt) {

                String email = getRequiredEmail(jwt);

                commentService.deleteComment(
                                commentId,
                                email);
        }

        /**
         * JWT에서 이메일 추출
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

                return normalizeEmail(email);
        }

        /**
         * JWT에서 사용자 ID 추출
         */
        private String getRequiredUserId(Jwt jwt) {
                if (jwt == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.UNAUTHORIZED,
                                        "로그인이 필요합니다.");
                }

                String userId = jwt.getSubject();

                if (userId == null || userId.isBlank()) {
                        throw new ResponseStatusException(
                                        HttpStatus.UNAUTHORIZED,
                                        "JWT에서 사용자 ID를 확인할 수 없습니다.");
                }

                return userId.trim();
        }

        /**
         * 관리자 권한 확인
         */
        private boolean isAdmin(Jwt jwt) {
                if (jwt == null) {
                        return false;
                }

                // 별도의 사용자 역할 claim 확인
                if (hasAdminRole(jwt.getClaim("user_role"))) {
                        return true;
                }

                // Supabase app_metadata 확인
                Object metadataClaim = jwt.getClaim("app_metadata");

                if (!(metadataClaim instanceof Map<?, ?> appMetadata)) {
                        return false;
                }

                return hasAdminRole(appMetadata.get("role"))
                                || hasAdminRole(appMetadata.get("roles"));
        }

        /**
         * 단일 역할 또는 역할 목록에서 관리자 권한 확인
         */
        private boolean hasAdminRole(Object roleValue) {
                if (roleValue == null) {
                        return false;
                }

                if (roleValue instanceof Collection<?> roles) {
                        return roles.stream()
                                        .anyMatch(this::hasAdminRole);
                }

                String role = roleValue
                                .toString()
                                .trim()
                                .toUpperCase();

                return "ADMIN".equals(role)
                                || "ROLE_ADMIN".equals(role);
        }

        /**
         * 이메일 비교를 위한 소문자 정규화
         */
        private String normalizeEmail(String email) {
                if (email == null) {
                        return "";
                }

                return email
                                .trim()
                                .toLowerCase();
        }
}