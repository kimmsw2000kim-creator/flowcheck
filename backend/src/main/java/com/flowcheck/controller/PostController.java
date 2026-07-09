package com.flowcheck.controller;

import com.flowcheck.domain.Comment;
import com.flowcheck.domain.Post;
import com.flowcheck.dto.CommentRequest;
import com.flowcheck.dto.CommentResponse;
import com.flowcheck.dto.PostListResponse;
import com.flowcheck.repository.CommentRepository;
import com.flowcheck.repository.PostRepository;
import com.flowcheck.dto.PostRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {

        private final PostRepository postRepository;
        private final CommentRepository commentRepository;

        @GetMapping
        public Page<PostListResponse> getPosts(Pageable pageable) {
                return postRepository.findAll(pageable)
                                .map(post -> new PostListResponse(
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
        public PostListResponse createPost(@RequestBody PostRequest request) {
                Post post = new Post();

                post.setTitle(request.getTitle());
                post.setContent(request.getContent());

                String email = "user@gmail.com";

                post.setEmail("user@gmail.com");
                post.setWriterEmail(email);
                post.setUserId(email);

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

        @PostMapping("/{postId}/like")
        public void likePost(@PathVariable Long postId) {
                Post post = postRepository.findById(postId)
                                .orElseThrow(() -> new RuntimeException("게시글을 찾을 수 없습니다."));

                post.setLikeCount(post.getLikeCount() + 1);
                postRepository.save(post);
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
        public void createComment(
                        @PathVariable Long postId,
                        @RequestBody CommentRequest request) {
                Comment comment = new Comment();
                comment.setPostId(postId);
                comment.setParentId(request.getParentId());
                comment.setContent(request.getContent());

                // 나중에 JWT 로그인 유저 이메일로 바꾸면 됨
                comment.setWriterEmail("jin1000066@gmail.com");

                commentRepository.save(comment);
        }
}