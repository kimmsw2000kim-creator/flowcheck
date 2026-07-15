package com.flowcheck.controller;

import com.flowcheck.domain.Comment;
import com.flowcheck.domain.Post;
import com.flowcheck.domain.PostLike;
import com.flowcheck.dto.*;
import com.flowcheck.repository.CommentRepository;
import com.flowcheck.repository.PostLikeRepository;
import com.flowcheck.repository.PostRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {

        private final PostRepository postRepository;
        private final CommentRepository commentRepository;
        private final PostLikeRepository postLikeRepository;

        @GetMapping
        public Page<PostListResponse> getPosts(
                @RequestParam(required = false) String keyword,
                @PageableDefault(
                        sort = "createdAt",
                        direction = Sort.Direction.DESC
                ) Pageable pageable) {

                Page<Post> posts;

                if (keyword == null || keyword.isBlank()) {
                        posts = postRepository.findAll(pageable);
                } else {
                        posts = postRepository
                                        .findByTitleContainingIgnoreCaseOrWriterEmailContainingIgnoreCase(
                                                        keyword,
                                                        keyword,
                                                        pageable);
                }

                return posts.map(post -> new PostListResponse(
                                post.getId(),
                                post.getTitle(),
                                post.getContent(),
                                post.getWriterEmail(),
                                post.getCreatedAt(),
                                post.getLikeCount(),
                                commentRepository.countByPostId(post.getId())));
        }

        @GetMapping("/{postId}")
        public PostListResponse getPost(@PathVariable Long postId) {
                Post post = postRepository.findById(postId)
                                .orElseThrow(() -> new RuntimeException("게시글을 찾을 수 없습니다."));

                return new PostListResponse(
                                post.getId(),
                                post.getTitle(),
                                post.getContent(),
                                post.getWriterEmail(),
                                post.getCreatedAt(),
                                post.getLikeCount(),
                                commentRepository.countByPostId(post.getId()));
        }

        @PostMapping
        public PostListResponse createPost(
                @RequestBody PostRequest request,
                @AuthenticationPrincipal Jwt jwt) {

                String email = jwt.getClaimAsString("email");
                String userId = jwt.getSubject();

                Post post = new Post();
                post.setTitle(request.getTitle());
                post.setContent(request.getContent());
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
                        0
                );
        }

        @PostMapping("/{postId}/like")
        public PostLikeResponse toggleLike(
                        @PathVariable Long postId,
                        @RequestBody PostLikeRequest request) {
                Post post = postRepository.findById(postId)
                                .orElseThrow(() -> new RuntimeException("게시글을 찾을 수 없습니다."));

                String email = request.getEmail();

                if (email == null || email.isBlank()) {
                        throw new IllegalArgumentException("로그인한 사용자 이메일이 필요합니다.");
                }

                boolean alreadyLiked = postLikeRepository.existsByPostIdAndUserEmail(postId, email);

                boolean liked;
                String message;

                if (alreadyLiked) {
                        PostLike existingLike = postLikeRepository
                                        .findByPostIdAndUserEmail(postId, email)
                                        .orElseThrow(() -> new RuntimeException("좋아요 정보를 찾을 수 없습니다."));

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

        @GetMapping("/{postId}/like-status")
        public PostLikeResponse getLikeStatus(
                        @PathVariable Long postId,
                        @RequestParam String email) {
                if (!postRepository.existsById(postId)) {
                        throw new RuntimeException("게시글을 찾을 수 없습니다.");
                }

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

        @GetMapping("/{postId}/comments")
        public List<CommentResponse> getComments(@PathVariable Long postId) {
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

        @PostMapping("/{postId}/comments")
        public CommentResponse createComment(
                        @PathVariable Long postId,
                        @RequestBody CommentRequest request) {

                Comment comment = new Comment();
                comment.setPostId(postId);
                comment.setParentId(request.getParentId());
                comment.setContent(request.getContent());

                String email = request.getEmail();

                if (email == null || email.isBlank()) {
                        email = "unknown@flowcheck.com";
                }

                comment.setWriterEmail(email);

                Comment saved = commentRepository.save(comment);

                return new CommentResponse(
                                saved.getId(),
                                saved.getContent(),
                                saved.getWriterEmail(),
                                saved.getCreatedAt(),
                                saved.getParentId(),
                                List.of());
        }

        @DeleteMapping("/comments/{commentId}")
        public void deleteComment(@PathVariable Long commentId) {
                Comment comment = commentRepository.findById(commentId)
                                .orElseThrow(() -> new RuntimeException("댓글을 찾을 수 없습니다."));

                commentRepository.delete(comment);
        }

        @DeleteMapping("/{postId}")
        public void deletePost(@PathVariable Long postId) {
                Post post = postRepository.findById(postId)
                                .orElseThrow(() -> new RuntimeException("게시글을 찾을 수 없습니다."));

                commentRepository.deleteByPostId(postId);
                postLikeRepository.deleteByPostId(postId);

                postRepository.delete(post);
        }

        @PutMapping("/{postId}")
        public PostListResponse updatePost(
                        @PathVariable Long postId,
                        @RequestBody PostRequest request) {
                Post post = postRepository.findById(postId)
                                .orElseThrow(() -> new RuntimeException("게시글을 찾을 수 없습니다."));

                post.setTitle(request.getTitle());
                post.setContent(request.getContent());

                Post updatedPost = postRepository.save(post);

                return new PostListResponse(
                                updatedPost.getId(),
                                updatedPost.getTitle(),
                                updatedPost.getContent(),
                                updatedPost.getWriterEmail(),
                                updatedPost.getCreatedAt(),
                                updatedPost.getLikeCount(),
                                commentRepository.countByPostId(updatedPost.getId()));
        }
}
