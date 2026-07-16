import { useEffect, useState } from 'react';
import {
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';

import {
  getPost,
  updatePost,
} from '../api/communityApi';
import {
  Button,
  EmptyState,
  PageHeader,
} from '../components/common';
import { PostEditorForm } from '../components/community';
import { COMMUNITY_LIMITS } from '../constants/communityLimits';
import {
  showErrorAlert,
  showSuccessAlert,
  showWarningAlert,
} from '../utils/alert';

interface PostEditorValue {
  title: string;
  content: string;
}

export default function PostEditPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { postId } = useParams<{ postId: string }>();

  const isFreeBoard = location.pathname.startsWith('/comment/');
  const returnPath = isFreeBoard ? '/comment' : '/community';

  const [initialValue, setInitialValue] =
    useState<PostEditorValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadPost = async () => {
      const id = Number(postId);

      if (!Number.isInteger(id) || id <= 0) {
        navigate(returnPath, { replace: true });
        return;
      }

      try {
        setLoading(true);
        setError('');

        const post = await getPost(id);

        if (cancelled) {
          return;
        }

        setInitialValue({
          title: post.title ?? '',
          content: post.content ?? '',
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : '게시글을 불러오지 못했습니다.',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPost();

    return () => {
      cancelled = true;
    };
  }, [navigate, postId, returnPath]);

  const submit = async (value: PostEditorValue) => {
    if (submitting) {
      return;
    }

    if (!localStorage.getItem('accessToken')) {
      await showWarningAlert(
        '로그인이 필요합니다.',
        '게시글 수정은 로그인 후 이용할 수 있습니다.',
      );

      navigate('/login');
      return;
    }

    const id = Number(postId);

    if (!Number.isInteger(id) || id <= 0) {
      await showErrorAlert(
        '수정 실패',
        '게시글 번호를 확인할 수 없습니다.',
      );

      navigate(returnPath);
      return;
    }

    const title = value.title.trim();
    const content = value.content.trim();

    if (!title) {
      await showWarningAlert(
        '제목을 입력해 주세요.',
        '게시글 제목은 비워둘 수 없습니다.',
      );
      return;
    }

    if (title.length > COMMUNITY_LIMITS.POST_TITLE) {
      await showWarningAlert(
        '제목이 너무 깁니다.',
        `게시글 제목은 최대 ${COMMUNITY_LIMITS.POST_TITLE}자까지 입력할 수 있습니다.`,
      );
      return;
    }

    if (!content) {
      await showWarningAlert(
        '내용을 입력해 주세요.',
        '게시글 본문은 비워둘 수 없습니다.',
      );
      return;
    }

    if (content.length > COMMUNITY_LIMITS.POST_CONTENT) {
      await showWarningAlert(
        '본문이 너무 깁니다.',
        `게시글 본문은 최대 ${COMMUNITY_LIMITS.POST_CONTENT.toLocaleString()}자까지 입력할 수 있습니다.`,
      );
      return;
    }

    try {
      setSubmitting(true);

      await updatePost(id, {
        title,
        content,
      });

      await showSuccessAlert(
        '수정 완료',
        '게시글이 정상적으로 수정되었습니다.',
      );

      navigate(returnPath);
    } catch (submitError) {
      await showErrorAlert(
        '수정 실패',
        submitError instanceof Error
          ? submitError.message
          : '게시글 수정 중 오류가 발생했습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="community-page community-page--narrow">
      <PageHeader
        eyebrow={isFreeBoard ? '자유게시판' : 'Community'}
        title="게시글 수정"
      />

      {loading && (
        <EmptyState
          title="게시글을 불러오는 중입니다."
          description="잠시만 기다려 주세요."
          aria-live="polite"
        />
      )}

      {!loading && error && (
        <EmptyState
          title={error}
          action={
            <Button
              variant="secondary"
              onClick={() => navigate(returnPath)}
            >
              목록으로
            </Button>
          }
        />
      )}

      {!loading && initialValue && (
        <PostEditorForm
          mode="edit"
          initialTitle={initialValue.title}
          initialContent={initialValue.content}
          submitting={submitting}
          onSubmit={submit}
          onCancel={() => navigate(returnPath)}
        />
      )}
    </div>
  );
}