import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getPost, updatePost } from '../api/communityApi';
import { Button, EmptyState, PageHeader } from '../components/common';
import { PostEditorForm } from '../components/community';
import { showErrorAlert, showSuccessAlert } from '../utils/alert';

export default function PostEditPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { postId } = useParams<{ postId: string }>();
  const isFreeBoard = location.pathname.startsWith('/comment/')
    || location.pathname.startsWith('/community/free/');
  const returnPath = isFreeBoard ? '/community?tab=free' : '/community';
  const [initialValue, setInitialValue] = useState<{ title: string; content: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      const id = Number(postId);
      if (!id) {
        navigate(returnPath);
        return;
      }
      try {
        const post = await getPost(id);
        setInitialValue({ title: post.title ?? '', content: post.content ?? '' });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '게시글을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [navigate, postId, returnPath]);

  const submit = async (value: { title: string; content: string }) => {
    if (!postId) return;
    try {
      setSubmitting(true);
      await updatePost(Number(postId), value);
      await showSuccessAlert('수정 완료', '게시글이 정상적으로 수정되었습니다.');
      navigate(returnPath);
    } catch (submitError) {
      await showErrorAlert('수정 실패', submitError instanceof Error ? submitError.message : '게시글 수정 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="community-page community-page--narrow">
      <PageHeader eyebrow={isFreeBoard ? '자유게시판' : 'Community'} title="게시글 수정" />
      {loading && <EmptyState title="게시글을 불러오는 중입니다." description="잠시만 기다려 주세요." aria-live="polite" />}
      {!loading && error && <EmptyState title={error} action={<Button variant="secondary" onClick={() => navigate(returnPath)}>목록으로</Button>} />}
      {!loading && initialValue && (
        <PostEditorForm mode="edit" initialTitle={initialValue.title} initialContent={initialValue.content} submitting={submitting} onSubmit={submit} onCancel={() => navigate(returnPath)} />
      )}
    </div>
  );
}
