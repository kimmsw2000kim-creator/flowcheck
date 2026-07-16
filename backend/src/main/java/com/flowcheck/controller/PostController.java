package com.flowcheck.controller;

import com.flowcheck.dto.CommentRequest;
import com.flowcheck.dto.CommentResponse;
import com.flowcheck.dto.PostLikeResponse;
import com.flowcheck.dto.PostListResponse;
import com.flowcheck.dto.PostRequest;
import com.flowcheck.service.CommentService;
import com.flowcheck.service.PostLikeService;
import com.flowcheck.service.PostService;

import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collection;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {

        private final PostService postService;
        private final PostLikeService postLikeService;
        private final CommentService commentService;

        /*
         * 게시글 목록 조회
         */
        @GetMapping
        public Page<PostListResponse> getPosts(
                        @RequestParam(required = false) String keyword,
                        Pageable pageable) {

                return postService.getPosts(
                                keyword,
                                pageable);
        }

        /*
         * 게시글 상세 조회
         */
        @GetMapping("/{postId}")
        public PostListResponse getPost(
                        @PathVariable Long postId) {

                return postService.getPost(postId);
        }

        /*
         * 게시글 작성
         */
        @PostMapping
        @ResponseStatus(HttpStatus.CREATED)
        public PostListResponse createPost(
                        @RequestBody PostRequest request,
                        @AuthenticationPrincipal Jwt jwt) {

                String email = getRequiredEmail(jwt);
                String userId = getRequiredUserId(jwt);

                return postService.createPost(
                                request,
                                email,
                                userId);
        }

        /*
         * 게시글 수정
         *
         * 현재는 작성자만 수정할 수 있도록 유지합니다.
         */
        @PutMapping("/{postId}")
        public PostListResponse updatePost(
                        @PathVariable Long postId,
                        @RequestBody PostRequest request,
                        @AuthenticationPrincipal Jwt jwt) {

                String email = getRequiredEmail(jwt);

                return postService.updatePost(
                                postId,
                                request,
                                email);
        }

        /*
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

        /*
         * 좋아요 등록 또는 취소
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

        /*
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

        /*
         * 댓글 및 답글 조회
         */
        @GetMapping("/{postId}/comments")
        public List<CommentResponse> getComments(
                        @PathVariable Long postId) {

                return commentService.getComments(postId);
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

                String email = getRequiredEmail(jwt);

                return commentService.createComment(
                                postId,
                                request,
                                email);
        }

        /*
         * 댓글 또는 답글 삭제
         *
         * 현재는 댓글 작성자만 삭제할 수 있도록 유지합니다.
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

        /*
         * JWT 이메일 추출
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

        /*
         * JWT 사용자 ID 추출
         */
        private String getRequiredUserId(Jwt jwt) {
                if (jwt == null
                                || jwt.getSubject() == null
                                || jwt.getSubject().isBlank()) {

                        throw new ResponseStatusException(
                                        HttpStatus.UNAUTHORIZED,
                                        "JWT에서 사용자 ID를 확인할 수 없습니다.");
                }

                return jwt.getSubject().trim();
        }

        /*
         * 관리자 권한 확인
         *
         * Supabase app_metadata 예시:
         *
         * {
         * "role": "ADMIN"
         * }
         *
         * 또는:
         *
         * {
         * "roles": ["ADMIN"]
         * }
         */
        private boolean isAdmin(Jwt jwt) {
                if (jwt == null) {
                        return false;
                }

                /*
                 * 별도의 신뢰 가능한 custom claim을 사용하는 경우
                 */
                if (hasAdminRole(jwt.getClaim("user_role"))) {
                        return true;
                }

                /*
                 * Supabase app_metadata의 역할 확인
                 */
                Map<String, Object> appMetadata = jwt.getClaim("app_metadata");

                if (appMetadata == null) {
                        return false;
                }

                return hasAdminRole(appMetadata.get("role"))
                                || hasAdminRole(appMetadata.get("roles"));
        }

        /*
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

        private String normalizeEmail(String email) {
                if (email == null) {
                        return "";
                }

                return email
                                .trim()
                                .toLowerCase();
        }
}