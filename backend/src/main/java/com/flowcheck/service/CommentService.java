package com.flowcheck.service;

import com.flowcheck.domain.Comment;
import com.flowcheck.dto.CommentRequest;
import com.flowcheck.dto.CommentResponse;
import com.flowcheck.repository.CommentRepository;
import com.flowcheck.repository.PostRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CommentService {

        private final PostRepository postRepository;
        private final CommentRepository commentRepository;

        /*
         * 댓글 및 답글 조회
         */
        public List<CommentResponse> getComments(Long postId) {
                validatePostExists(postId);

                List<Comment> comments = commentRepository
                                .findByPostIdOrderByCreatedAtAsc(postId);

                /*
                 * 부모 댓글 ID별로 답글을 묶습니다.
                 */
                Map<Long, List<CommentResponse>> repliesByParentId = comments.stream()
                                .filter(comment -> comment.getParentId() != null)
                                .collect(
                                                Collectors.groupingBy(
                                                                Comment::getParentId,
                                                                LinkedHashMap::new,
                                                                Collectors.mapping(
                                                                                this::toReplyResponse,
                                                                                Collectors.toList())));

                /*
                 * 부모 댓글에 답글 목록을 넣어 반환합니다.
                 */
                return comments.stream()
                                .filter(comment -> comment.getParentId() == null)
                                .map(parent -> new CommentResponse(
                                                parent.getId(),
                                                parent.getContent(),
                                                parent.getWriterEmail(),
                                                parent.getCreatedAt(),
                                                null,
                                                repliesByParentId.getOrDefault(
                                                                parent.getId(),
                                                                List.of())))
                                .toList();
        }

        /*
         * 댓글 또는 답글 작성
         */
        @Transactional
        public CommentResponse createComment(
                        Long postId,
                        CommentRequest request,
                        String writerEmail) {

                validatePostExists(postId);
                validateCommentRequest(request);

                /*
                 * parentId가 있다면 답글입니다.
                 * 부모 댓글이 실제로 존재하고,
                 * 현재 게시글에 속하는지 확인합니다.
                 */
                if (request.getParentId() != null) {
                        Comment parentComment = commentRepository
                                        .findById(request.getParentId())
                                        .orElseThrow(() -> new ResponseStatusException(
                                                        HttpStatus.NOT_FOUND,
                                                        "부모 댓글을 찾을 수 없습니다."));

                        if (!postId.equals(parentComment.getPostId())) {
                                throw new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "다른 게시글의 댓글에는 답글을 작성할 수 없습니다.");
                        }
                }

                Comment comment = new Comment();

                comment.setPostId(postId);
                comment.setParentId(request.getParentId());
                comment.setContent(request.getContent().trim());
                comment.setWriterEmail(writerEmail);

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
         * 댓글 또는 답글 삭제
         */
        @Transactional
        public void deleteComment(
                        Long commentId,
                        String loginEmail) {

                Comment comment = commentRepository.findById(commentId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "댓글을 찾을 수 없습니다."));

                validateOwner(
                                loginEmail,
                                comment.getWriterEmail(),
                                "본인이 작성한 댓글만 삭제할 수 있습니다.");

                /*
                 * 부모 댓글 삭제 시 답글도 함께 삭제합니다.
                 */
                if (comment.getParentId() == null) {
                        commentRepository.deleteByParentId(commentId);
                }

                commentRepository.delete(comment);
        }

        /*
         * 답글 응답 변환
         */
        private CommentResponse toReplyResponse(Comment reply) {
                return new CommentResponse(
                                reply.getId(),
                                reply.getContent(),
                                reply.getWriterEmail(),
                                reply.getCreatedAt(),
                                reply.getParentId(),
                                List.of());
        }

        /*
         * 게시글 존재 여부 확인
         */
        private void validatePostExists(Long postId) {
                if (!postRepository.existsById(postId)) {
                        throw new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "게시글을 찾을 수 없습니다.");
                }
        }

        /*
         * 댓글 입력값 검사
         */
        private void validateCommentRequest(CommentRequest request) {
                if (request == null
                                || request.getContent() == null
                                || request.getContent().isBlank()) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "댓글 내용을 입력해주세요.");
                }
        }

        /*
         * 댓글 작성자 본인 확인
         */
        private void validateOwner(
                        String loginEmail,
                        String writerEmail,
                        String message) {

                if (writerEmail == null
                                || !loginEmail.equalsIgnoreCase(writerEmail.trim())) {

                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        message);
                }
        }
}