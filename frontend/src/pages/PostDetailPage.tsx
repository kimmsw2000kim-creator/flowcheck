import {
  useCallback,
  useEffect,
  useRef,
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
  CommentPagination,
  COMMENTS_PER_PAGE,
  ForumCommentThread,
  ForumPostDetail,
} from '../components/community';

import { COMMUNITY_LIMITS } from '../constants/communityLimits';

import type {
  ForumComment,
  ForumPost,
} from '../types/community';

import {
  showConfirmAlert,
  showErrorAlert,
  showSuccessAlert,
  showWarningAlert,
} from '../utils/alert';

/**
 * 이메일 앞뒤 공백과 대소문자를 정규화합니다.
 */
const normalizeEmail = (
  email?: string | null,
) => email?.trim().toLowerCase() ?? '';

/**
 * 알 수 없는 오류를 사용자 메시지로 변환합니다.
 */
const getErrorMessage = (
  error: unknown,
  fallbackMessage: string,
) => {
  return error instanceof Error
    ? error.message
    : fallbackMessage;
};

/**
 * 댓글 또는 답글 등록 직전 입력값을 검사합니다.
 */
const validateCommentContent = async (
  content: string,
  type: '댓글' | '답글',
) => {
  const limit =
    type === '댓글'
      ? COMMUNITY_LIMITS.COMMENT
      : COMMUNITY_LIMITS.REPLY;

  if (!content) {
    await showWarningAlert(
      `${type}을 입력해 주세요.`,
      `${type} 내용은 비워둘 수 없습니다.`,
    );

    return false;
  }

  if (content.length > limit) {
    await showWarningAlert(
      `${type} 글자 수 초과`,
      `${type}은 최대 ${limit}자까지 입력할 수 있습니다.`,
    );

    return false;
  }

  return true;
};

export default function PostDetailPage() {
  const navigate = useNavigate();
  const { postId } = useParams<{ postId: string }>();

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

  const [commentPage, setCommentPage] =
    useState(1);

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
   * 500자 초과 경고가 키 입력마다 반복되지 않도록 관리합니다.
   */
  const commentLimitWarnedRef =
    useRef(false);

  const replyLimitWarnedRef =
    useRef(false);

  /**
   * 댓글 20개 단위 페이징
   */
  const totalCommentPages = Math.max(
    1,
    Math.ceil(
      comments.length / COMMENTS_PER_PAGE,
    ),
  );

  const paginatedComments = comments.slice(
    (commentPage - 1) * COMMENTS_PER_PAGE,
    commentPage * COMMENTS_PER_PAGE,
  );

  /**
   * 로그인 사용자 정보
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
   * 댓글 입력 도중 500자를 초과하면 즉시 경고합니다.
   *
   * 500자를 초과한 값은 저장하지 않고
   * 앞에서부터 500자까지만 유지합니다.
   */
  const handleCommentValueChange = (
    nextValue: string,
  ) => {
    const limit = COMMUNITY_LIMITS.COMMENT;

    if (nextValue.length <= limit) {
      setCommentValue(nextValue);
      commentLimitWarnedRef.current = false;
      return;
    }

    setCommentValue(
      nextValue.slice(0, limit),
    );

    if (commentLimitWarnedRef.current) {
      return;
    }

    commentLimitWarnedRef.current = true;

    void showWarningAlert(
      '댓글 글자 수 초과',
      `댓글은 최대 ${limit}자까지 입력할 수 있습니다.`,
    );
  };

  /**
   * 답글 입력 도중 500자를 초과하면 즉시 경고합니다.
   */
  const handleReplyValueChange = (
    nextValue: string,
  ) => {
    const limit = COMMUNITY_LIMITS.REPLY;

    if (nextValue.length <= limit) {
      setReplyValue(nextValue);
      replyLimitWarnedRef.current = false;
      return;
    }

    setReplyValue(
      nextValue.slice(0, limit),
    );

    if (replyLimitWarnedRef.current) {
      return;
    }

    replyLimitWarnedRef.current = true;

    void showWarningAlert(
      '답글 글자 수 초과',
      `답글은 최대 ${limit}자까지 입력할 수 있습니다.`,
    );
  };

  /**
   * 게시글과 댓글을 새로고침합니다.
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
      setError(
        '올바르지 않은 게시글 번호입니다.',
      );
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

        // 좋아요 상태 조회 실패가
        // 게시글 전체 로딩을 막지 않도록 처리합니다.
        getLikeStatus(id).catch(() => ({
          liked: false,
        })),
      ]);

      setPost(nextPost);
      setComments(nextComments);
      setLiked(likeStatus.liked);

      setCommentPage(1);
      setCommentValue('');
      setReplyValue('');
      setReplyParentId(null);

      commentLimitWarnedRef.current = false;
      replyLimitWarnedRef.current = false;
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
   * 마지막 댓글 페이지에서 댓글을 삭제했을 때
   * 존재하지 않는 페이지가 유지되는 것을 막습니다.
   */
  useEffect(() => {
    setCommentPage((currentPage) =>
      Math.min(
        Math.max(currentPage, 1),
        totalCommentPages,
      ),
    );
  }, [totalCommentPages]);

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

    if (id === null) {
      return;
    }

    const content = commentValue.trim();

    const valid =
      await validateCommentContent(
        content,
        '댓글',
      );

    if (!valid) {
      return;
    }

    try {
      await createComment(id, {
        content,
        parentId: null,
      });

      setCommentValue('');
      setCommentPage(1);

      commentLimitWarnedRef.current = false;

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

    if (id === null) {
      return;
    }

    const content = replyValue.trim();

    const valid =
      await validateCommentContent(
        content,
        '답글',
      );

    if (!valid) {
      return;
    }

    try {
      await createComment(id, {
        content,
        parentId,
      });

      setReplyValue('');
      setReplyParentId(null);

      replyLimitWarnedRef.current = false;

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
        title:
          `${commentType}을 삭제하시겠습니까?`,
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
   * 게시글 작성자 확인
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
   * 작성자 또는 관리자는 게시글을 삭제할 수 있습니다.
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
        comments={paginatedComments}
        commentCount={post.commentCount ?? 0}
        currentUserEmail={currentUserEmail}
        value={commentValue}
        replyValue={replyValue}
        replyParentId={replyParentId}
        onValueChange={handleCommentValueChange}
        onReplyValueChange={handleReplyValueChange}
        onSubmit={submitComment}
        onSubmitReply={submitReply}
        onToggleReply={(nextId) => {
          setReplyParentId(nextId);
          setReplyValue('');
          replyLimitWarnedRef.current = false;
        }}
        onDelete={(commentId, isReply) =>
          void removeComment(commentId, isReply)
        }
      />

      <CommentPagination
        currentPage={commentPage}
        totalPages={totalCommentPages}
        onPageChange={(nextPage) => {
          setCommentPage(nextPage);

          setReplyParentId(null);
          setReplyValue('');

          replyLimitWarnedRef.current = false;
        }}
      />
    </div>
  );
}