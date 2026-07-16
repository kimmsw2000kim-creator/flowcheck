package com.flowcheck.controller;

import com.flowcheck.domain.PostCategory;
import com.flowcheck.dto.community.CommunityPostRequest;
import com.flowcheck.dto.community.CommunityPostResponse;
import com.flowcheck.dto.community.CommunityPostUpdateRequest;
import com.flowcheck.dto.community.CommunitySharedTestResultResponse;
import com.flowcheck.service.CommunityPostService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Tag(name = "Community Posts", description = "테스트 공유와 사이트 홍보 게시글 API")
@RestController
@RequestMapping("/api/community/posts")
@RequiredArgsConstructor
public class CommunityPostController {

        private final CommunityPostService communityPostService;

        /*
         * 카테고리별 게시글 목록을 조회합니다.
         *
         * 기본 정렬은 최신 작성일순이며,
         * 요청의 sort 값으로 다른 정렬을 전달할 수도 있습니다.
         */
        @Operation(summary = "커뮤니티 게시글 목록 조회")
        @GetMapping
        public ResponseEntity<Page<CommunityPostResponse>> getPosts(
                        @RequestParam PostCategory category,
                        @RequestParam(required = false) String keyword,
                        @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
                Page<CommunityPostResponse> response = communityPostService.findPosts(
                                category,
                                keyword,
                                pageable);

                return ResponseEntity.ok(response);
        }

        /*
         * 게시글 ID를 이용해 상세 내용을 조회합니다.
         */
        @Operation(summary = "커뮤니티 게시글 상세 조회")
        @GetMapping("/{postId}")
        public ResponseEntity<CommunityPostResponse> getPost(
                        @PathVariable Long postId) {
                CommunityPostResponse response = communityPostService.findPost(postId);

                return ResponseEntity.ok(response);
        }

        /*
         * 테스트 공유 게시글에 연결된 실제 테스트 결과를 조회합니다.
         *
         * requestId를 외부에서 직접 받지 않고 게시글 번호를 이용해
         * 서버가 연결된 테스트 요청을 찾습니다.
         */
        @Operation(summary = "커뮤니티 공유 테스트 결과 조회")
        @GetMapping("/{postId}/test-result")
        public ResponseEntity<CommunitySharedTestResultResponse> getSharedTestResult(
                        @PathVariable Long postId) {
                CommunitySharedTestResultResponse response = communityPostService.findSharedTestResult(
                                postId);

                return ResponseEntity.ok(response);
        }

        /*
         * 로그인한 사용자의 게시글을 생성합니다.
         *
         * userId와 email은 요청 본문에서 받지 않고
         * 검증된 JWT의 subject 값을 사용합니다.
         */
        @Operation(summary = "커뮤니티 게시글 작성")
        @PostMapping
        public ResponseEntity<CommunityPostResponse> createPost(
                        @AuthenticationPrincipal Jwt jwt,
                        @Valid @RequestBody CommunityPostRequest request) {
                UUID userId = extractUserId(jwt);

                CommunityPostResponse response = communityPostService.create(
                                userId,
                                request);

                return ResponseEntity
                                .status(HttpStatus.CREATED)
                                .body(response);
        }

        /*
         * 로그인한 사용자가 본인의 게시글을 수정합니다.
         *
         * 실제 작성자 확인은 Service에서 JWT 사용자 ID를 기준으로 처리합니다.
         */
        @Operation(summary = "커뮤니티 게시글 수정")
        @PutMapping("/{postId}")
        public ResponseEntity<CommunityPostResponse> updatePost(
                        @AuthenticationPrincipal Jwt jwt,
                        @PathVariable Long postId,
                        @Valid @RequestBody CommunityPostUpdateRequest request) {
                UUID userId = extractUserId(jwt);

                CommunityPostResponse response = communityPostService.update(
                                userId,
                                postId,
                                request);

                return ResponseEntity.ok(response);
        }

        /*
         * 로그인한 사용자가 본인의 게시글을 삭제합니다.
         *
         * 다른 사용자의 게시글을 삭제하려고 하면
         * Service에서 403 Forbidden을 반환합니다.
         */
        @Operation(summary = "커뮤니티 게시글 삭제")
        @DeleteMapping("/{postId}")
        public ResponseEntity<Void> deletePost(
                        @AuthenticationPrincipal Jwt jwt,
                        @PathVariable Long postId) {
                UUID userId = extractUserId(jwt);

                communityPostService.delete(
                                userId,
                                postId);

                /*
                 * 삭제 성공 시 응답 본문 없이 204 상태를 반환합니다.
                 */
                return ResponseEntity.noContent().build();
        }

        /*
         * Supabase JWT의 subject를 사용자 UUID로 변환합니다.
         */
        private UUID extractUserId(Jwt jwt) {
                if (jwt == null
                                || jwt.getSubject() == null
                                || jwt.getSubject().isBlank()) {
                        throw new ResponseStatusException(
                                        HttpStatus.UNAUTHORIZED,
                                        "로그인이 필요합니다.");
                }

                try {
                        return UUID.fromString(jwt.getSubject());
                } catch (IllegalArgumentException exception) {
                        throw new ResponseStatusException(
                                        HttpStatus.UNAUTHORIZED,
                                        "올바르지 않은 사용자 인증 정보입니다.");
                }
        }
}