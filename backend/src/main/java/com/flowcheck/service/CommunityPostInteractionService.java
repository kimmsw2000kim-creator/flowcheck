package com.flowcheck.service;

import com.flowcheck.domain.CommunityPost;
import com.flowcheck.domain.CommunityPostComment;
import com.flowcheck.domain.CommunityPostLike;
import com.flowcheck.domain.User;
import com.flowcheck.dto.CommentRequest;
import com.flowcheck.dto.community.CommunityPostCommentResponse;
import com.flowcheck.dto.community.CommunityPostLikeResponse;
import com.flowcheck.repository.CommunityPostCommentRepository;
import com.flowcheck.repository.CommunityPostLikeRepository;
import com.flowcheck.repository.CommunityPostRepository;
import com.flowcheck.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CommunityPostInteractionService {

    private final CommunityPostRepository communityPostRepository;
    private final CommunityPostLikeRepository communityPostLikeRepository;
    private final CommunityPostCommentRepository communityPostCommentRepository;
    private final UserRepository userRepository;

    @Transactional
    public CommunityPostLikeResponse toggleLike(Long postId, UUID userId) {
        CommunityPost post = findPost(postId);
        User user = findUser(userId);
        var existingLike = communityPostLikeRepository
                .findByPost_PostIdAndUser_UserId(postId, userId);

        boolean liked;
        String message;
        if (existingLike.isPresent()) {
            communityPostLikeRepository.delete(existingLike.get());
            liked = false;
            message = "좋아요를 취소했습니다.";
        } else {
            communityPostLikeRepository.save(new CommunityPostLike(post, user));
            liked = true;
            message = "좋아요를 등록했습니다.";
        }

        long likeCount = communityPostLikeRepository.countByPost_PostId(postId);
        return new CommunityPostLikeResponse(postId, likeCount, liked, message);
    }

    public CommunityPostLikeResponse getLikeStatus(Long postId, UUID userId) {
        findPost(postId);
        findUser(userId);

        boolean liked = communityPostLikeRepository
                .existsByPost_PostIdAndUser_UserId(postId, userId);
        long likeCount = communityPostLikeRepository.countByPost_PostId(postId);

        return new CommunityPostLikeResponse(
                postId,
                likeCount,
                liked,
                liked ? "좋아요를 누른 게시글입니다." : "좋아요를 누르지 않은 게시글입니다."
        );
    }

    public Page<CommunityPostCommentResponse> getComments(Long postId, Pageable pageable) {
        findPost(postId);

        int pageSize = Math.min(Math.max(pageable.getPageSize(), 1), 50);
        Pageable normalizedPageable = PageRequest.of(pageable.getPageNumber(), pageSize);
        Page<CommunityPostComment> parentPage = communityPostCommentRepository
                .findByPost_PostIdAndParentIsNullOrderByCreatedAtAsc(postId, normalizedPageable);
        List<Long> parentIds = parentPage.stream()
                .map(CommunityPostComment::getId)
                .toList();

        // 현재 페이지의 답글만 일괄 조회합니다.
        Map<Long, List<CommunityPostCommentResponse>> repliesByParentId = parentIds.isEmpty()
                ? Map.of()
                : communityPostCommentRepository.findByParent_IdInOrderByCreatedAtAsc(parentIds)
                        .stream()
                        .collect(Collectors.groupingBy(
                                reply -> reply.getParent().getId(),
                                LinkedHashMap::new,
                                Collectors.mapping(this::toReplyResponse, Collectors.toList())
                        ));

        return parentPage.map(parent -> toParentResponse(
                parent,
                repliesByParentId.getOrDefault(parent.getId(), List.of())
        ));
    }

    @Transactional
    public CommunityPostCommentResponse createComment(
            Long postId,
            UUID userId,
            CommentRequest request
    ) {
        CommunityPost post = findPost(postId);
        User user = findUser(userId);
        validateContent(request);

        CommunityPostComment parent = null;
        if (request.getParentId() != null) {
            parent = communityPostCommentRepository.findById(request.getParentId())
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "부모 댓글을 찾을 수 없습니다."
                    ));
            if (!Objects.equals(parent.getPost().getPostId(), postId)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "다른 게시글의 댓글에는 답글을 작성할 수 없습니다."
                );
            }
            if (parent.getParent() != null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "답글에는 추가 답글을 작성할 수 없습니다."
                );
            }
        }

        CommunityPostComment savedComment = communityPostCommentRepository.save(
                new CommunityPostComment(post, user, parent, request.getContent().trim())
        );
        return toReplyResponse(savedComment);
    }

    @Transactional
    public void deleteComment(Long commentId, UUID userId) {
        CommunityPostComment comment = communityPostCommentRepository.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "댓글을 찾을 수 없습니다."
                ));

        if (!Objects.equals(comment.getUser().getUserId(), userId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "본인이 작성한 댓글만 삭제할 수 있습니다."
            );
        }

        // 부모 댓글의 답글은 DB 외래 키 설정으로 함께 삭제됩니다.
        communityPostCommentRepository.delete(comment);
    }

    private CommunityPost findPost(Long postId) {
        return communityPostRepository.findByPostId(postId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "게시글을 찾을 수 없습니다."
                ));
    }

    private User findUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "사용자를 찾을 수 없습니다."
                ));
    }

    private void validateContent(CommentRequest request) {
        if (request == null || request.getContent() == null || request.getContent().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "댓글 내용을 입력해주세요.");
        }
        if (request.getContent().trim().length() > 500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "댓글은 최대 500자까지 입력할 수 있습니다.");
        }
    }

    private CommunityPostCommentResponse toParentResponse(
            CommunityPostComment comment,
            List<CommunityPostCommentResponse> replies
    ) {
        return new CommunityPostCommentResponse(
                comment.getId(),
                comment.getContent(),
                comment.getUser().getEmail(),
                comment.getUser().getAvatarUrl(),
                comment.getCreatedAt(),
                null,
                replies
        );
    }

    private CommunityPostCommentResponse toReplyResponse(CommunityPostComment comment) {
        return new CommunityPostCommentResponse(
                comment.getId(),
                comment.getContent(),
                comment.getUser().getEmail(),
                comment.getUser().getAvatarUrl(),
                comment.getCreatedAt(),
                comment.getParent() == null ? null : comment.getParent().getId(),
                List.of()
        );
    }
}
