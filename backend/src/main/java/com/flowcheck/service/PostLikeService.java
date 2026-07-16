package com.flowcheck.service;

import com.flowcheck.domain.Post;
import com.flowcheck.domain.PostLike;
import com.flowcheck.dto.PostLikeResponse;
import com.flowcheck.repository.PostLikeRepository;
import com.flowcheck.repository.PostRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PostLikeService {

    private final PostRepository postRepository;
    private final PostLikeRepository postLikeRepository;

    /*
     * 좋아요 등록 또는 취소
     */
    @Transactional
    public PostLikeResponse toggleLike(
            Long postId,
            String userEmail) {

        Post post = getPostOrThrow(postId);

        Optional<PostLike> existingLike = postLikeRepository.findByPostIdAndUserEmail(
                postId,
                userEmail);

        boolean liked;
        String message;

        if (existingLike.isPresent()) {
            postLikeRepository.delete(existingLike.get());

            liked = false;
            message = "좋아요가 취소되었습니다.";
        } else {
            PostLike postLike = new PostLike();

            postLike.setPostId(postId);
            postLike.setUserEmail(userEmail);

            postLikeRepository.save(postLike);

            liked = true;
            message = "좋아요가 등록되었습니다.";
        }

        long likeCount = postLikeRepository.countByPostId(postId);

        /*
         * Post 테이블의 likeCount도 현재 개수와 맞춰줍니다.
         */
        post.setLikeCount((int) likeCount);

        postRepository.save(post);

        return new PostLikeResponse(
                postId,
                likeCount,
                liked,
                message);
    }

    /*
     * 현재 사용자의 좋아요 여부 조회
     */
    public PostLikeResponse getLikeStatus(
            Long postId,
            String userEmail) {

        getPostOrThrow(postId);

        boolean liked = postLikeRepository
                .existsByPostIdAndUserEmail(
                        postId,
                        userEmail);

        long likeCount = postLikeRepository.countByPostId(postId);

        String message = liked
                ? "이미 좋아요를 누른 게시글입니다."
                : "좋아요를 누르지 않은 게시글입니다.";

        return new PostLikeResponse(
                postId,
                likeCount,
                liked,
                message);
    }

    /*
     * 게시글 존재 여부 확인
     */
    private Post getPostOrThrow(Long postId) {
        return postRepository.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "게시글을 찾을 수 없습니다."));
    }
}