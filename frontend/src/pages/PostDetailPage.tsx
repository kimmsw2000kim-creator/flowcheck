import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import {
  createComment,
  deleteComment,
  deletePost,
  getComments,
  getLikeStatus,
  getPost,
  likePost,
} from '../api/communityApi';

import {
  Button,
  EmptyState,
} from '../components/common';

import {
  ForumCommentThread,
  ForumPostDetail,
} from '../components/community';

import type {
  ForumComment,
  ForumPost,
} from '../types/community';

import {
  showConfirmAlert,
  showErrorAlert,
  showSuccessAlert,
} from '../utils/alert';

/**
 * 이메일 비교 시 대소문자와 앞뒤 공백을 무시합니다.
 */
const normalizeEmail = (
  email?: string | null,
) => email?.trim().toLowerCase() ?? '';

/**
 * 알 수 없는 오류를 사용자에게 보여줄 문자열로 변환합니다.
 */
const getErrorMessage = (
  error: unknown,
  fallbackMessage: string,
) => {
  return error instanceof Error
    ? error.message
    : fallbackMessage;
};

export default function PostDetailPage() {
  const navigate = useNavigate();
  const { postId } = useParams();

  const parsedPostId = Number(postId);

  const id =
    Number.isInteger(parsedPostId) &&
      parsedPostId > 0
      ? parsedPostId
      : null;

  const [post, setPost] =
    useState<ForumPost | null>(null);

  const [comments, setComments] =
    useState<ForumComment[]>([]);

  const [liked, setLiked] =
    useState(false);

  const [commentValue, setCommentValue] =
    useState('');

  const [replyValue, setReplyValue] =
    useState('');

  const [replyParentId, setReplyParentId] =
    useState<number | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  /**
   * 현재 로그인 사용자의 이메일
   */
  const currentUserEmail = normalizeEmail(
    localStorage.getItem('email'),
  );

  const currentUserRole = (
    localStorage.getItem('role') ?? ''
  )
    .trim()
    .toUpperCase();

  const isAdmin =
    currentUserRole === 'ADMIN' ||
    currentUserRole === 'ROLE_ADMIN';

  /**
   * 게시글과 댓글 새로고침
   */
  const refresh = useCallback(async () => {
    if (id === null) {
      return;
    }

    const [
      nextPost,
      nextComments,
    ] = await Promise.all([
      getPost(id),
      getComments(id),
    ]);

    setPost(nextPost);
    setComments(nextComments);
  }, [id]);

  /**
   * 게시글 상세 페이지 최초 로딩
   */
  const load = useCallback(async () => {
    if (id === null) {
      setPost(null);
      setComments([]);
      setError('올바르지 않은 게시글 번호입니다.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [
        nextPost,
        nextComments,
        likeStatus,
      ] = await Promise.all([
        getPost(id),
        getComments(id),

        // 좋아요 상태 조회가 실패하더라도
        // 게시글 상세 화면은 정상적으로 보여줍니다.
        getLikeStatus(id).catch(() => ({
          liked: false,
        })),
      ]);

      setPost(nextPost);
      setComments(nextComments);
      setLiked(likeStatus.liked);
    } catch (loadError) {
      setPost(null);
      setComments([]);

      setError(
        getErrorMessage(
          loadError,
          '게시글을 불러오지 못했습니다.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * 좋아요 등록 또는 취소
   */
  const toggleLike = async () => {
    if (id === null || !post) {
      return;
    }

    try {
      const result = await likePost(id);

      setLiked(result.liked);

      setPost((previousPost) => {
        if (!previousPost) {
          return null;
        }

        return {
          ...previousPost,
          likeCount: result.likeCount,
          likes: result.likeCount,
        };
      });
    } catch (likeError) {
      await showErrorAlert(
        '좋아요 처리 실패',
        getErrorMessage(
          likeError,
          '좋아요 처리 중 오류가 발생했습니다.',
        ),
      );
    }
  };

  /**
   * 댓글 등록
   */
  const submitComment = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const content = commentValue.trim();

    if (id === null || !content) {
      return;
    }

    try {
      await createComment(id, {
        content,
        parentId: null,
      });

      setCommentValue('');

      await refresh();

      await showSuccessAlert(
        '댓글 등록 완료',
        '댓글이 등록되었습니다.',
      );
    } catch (commentError) {
      await showErrorAlert(
        '댓글 등록 실패',
        getErrorMessage(
          commentError,
          '댓글 등록 중 오류가 발생했습니다.',
        ),
      );
    }
  };

  /**
   * 답글 등록
   */
  const submitReply = async (
    event: FormEvent<HTMLFormElement>,
    parentId: number,
  ) => {
    event.preventDefault();

    const content = replyValue.trim();

    if (id === null || !content) {
      return;
    }

    try {
      await createComment(id, {
        content,
        parentId,
      });

      setReplyValue('');
      setReplyParentId(null);

      await refresh();

      await showSuccessAlert(
        '답글 등록 완료',
        '답글이 등록되었습니다.',
      );
    } catch (replyError) {
      await showErrorAlert(
        '답글 등록 실패',
        getErrorMessage(
          replyError,
          '답글 등록 중 오류가 발생했습니다.',
        ),
      );
    }
  };

  /**
   * 댓글 또는 답글 삭제
   */
  const removeComment = async (
    commentId: number,
    isReply = false,
  ) => {
    const commentType =
      isReply ? '답글' : '댓글';

    const confirmed =
      await showConfirmAlert({
        title: `${commentType}을 삭제하시겠습니까?`,
        text:
          '삭제한 내용은 복구할 수 없습니다.',
        confirmText: '삭제',
        cancelText: '취소',
        danger: true,
      });

    if (!confirmed) {
      return;
    }

    try {
      await deleteComment(commentId);
      await refresh();

      await showSuccessAlert(
        '삭제 완료',
        `${commentType}이 삭제되었습니다.`,
      );
    } catch (deleteError) {
      await showErrorAlert(
        '삭제 실패',
        getErrorMessage(
          deleteError,
          `${commentType} 삭제 중 오류가 발생했습니다.`,
        ),
      );
    }
  };

  /**
   * 게시글 삭제
   */
  const removePost = async () => {
    if (id === null) {
      return;
    }

    const confirmed =
      await showConfirmAlert({
        title:
          '게시글을 삭제하시겠습니까?',
        text:
          '댓글과 좋아요 정보도 함께 삭제됩니다.',
        confirmText: '삭제',
        cancelText: '취소',
        danger: true,
      });

    if (!confirmed) {
      return;
    }

    try {
      await deletePost(id);

      await showSuccessAlert(
        '삭제 완료',
        '게시글이 삭제되었습니다.',
      );

      navigate('/community', {
        replace: true,
      });
    } catch (deleteError) {
      await showErrorAlert(
        '게시글 삭제 실패',
        getErrorMessage(
          deleteError,
          '게시글 삭제 중 오류가 발생했습니다.',
        ),
      );
    }
  };

  /**
   * 작성자 확인
   *
   * 이메일이 모두 존재하면서 정확히 같은 경우에만
   * 수정 및 삭제 권한을 부여합니다.
   */
  const writerEmail = normalizeEmail(
    post?.writerEmail ?? post?.email,
  );

  const isOwner = Boolean(
    currentUserEmail &&
    writerEmail &&
    currentUserEmail === writerEmail,
  );

  /**
   * 작성자는 자신의 게시글을 삭제할 수 있고,
   * 관리자는 모든 게시글을 삭제할 수 있습니다.
   */
  const canDeletePost =
    isOwner || isAdmin;

  if (loading) {
    return (
      <div className="community-page">
        <EmptyState
          title="게시글을 불러오는 중입니다."
          description="잠시만 기다려 주세요."
          aria-live="polite"
        />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="community-page">
        <EmptyState
          title={
            error ||
            '게시글을 찾을 수 없습니다.'
          }
          action={
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                navigate('/community')
              }
            >
              목록으로
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="community-page">
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          navigate('/community')
        }
      >
        ← 게시판 목록으로
      </Button>

      <ForumPostDetail
        post={post}
        liked={liked}
        onLike={() =>
          void toggleLike()
        }
        onEdit={
          isOwner
            ? () =>
              navigate(
                `/community/${id}/edit`,
              )
            : undefined
        }
        onDelete={
          canDeletePost
            ? () => void removePost()
            : undefined
        }
      />

      <ForumCommentThread
        comments={comments}
        currentUserEmail={
          currentUserEmail
        }
        value={commentValue}
        replyValue={replyValue}
        replyParentId={
          replyParentId
        }
        onValueChange={
          setCommentValue
        }
        onReplyValueChange={
          setReplyValue
        }
        onSubmit={submitComment}
        onSubmitReply={submitReply}
        onToggleReply={(nextId) => {
          setReplyParentId(nextId);
          setReplyValue('');
        }}
        onDelete={(
          commentId,
          isReply,
        ) =>
          void removeComment(
            commentId,
            isReply,
          )
        }
      />
    </div>
  );
}