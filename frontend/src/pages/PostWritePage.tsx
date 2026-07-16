import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { createPost } from '../api/communityApi';
import { PageHeader } from '../components/common';
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

export default function PostWritePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [submitting, setSubmitting] = useState(false);
  const isFreeBoard = location.pathname.startsWith('/comment')
    || location.pathname.startsWith('/community/free');
  const returnPath = isFreeBoard ? '/community?tab=free' : '/community';

  const submit = async (value: PostEditorValue) => {
    if (submitting) {
      return;
    }

    if (!localStorage.getItem('accessToken')) {
      await showWarningAlert(
        '로그인이 필요합니다.',
        '게시글 작성은 로그인 후 이용할 수 있습니다.',
      );

      navigate('/login');
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

      await createPost({
        title,
        content,
      });

      await showSuccessAlert(
        '작성 완료',
        '게시글이 정상적으로 등록되었습니다.',
      );

      navigate(returnPath);
    } catch (error) {
      await showErrorAlert(
        '작성 실패',
        error instanceof Error
          ? error.message
          : '게시글 작성 중 오류가 발생했습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="community-page community-page--narrow">
      <PageHeader
        eyebrow={isFreeBoard ? '자유게시판' : 'Community'}
        title="게시글 작성"
        description="다른 사용자와 공유할 내용을 작성해 주세요."
      />

      <PostEditorForm
        mode="create"
        submitting={submitting}
        onSubmit={submit}
        onCancel={() => navigate(returnPath)}
      />
    </div>
  );
}