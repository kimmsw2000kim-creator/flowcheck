import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createComment, deleteComment, deletePost, getComments, getLikeStatus, getPost, likePost } from '../api/communityApi';
import { Button, EmptyState } from '../components/common';
import { ForumCommentThread, ForumPostDetail } from '../components/community';
import type { ForumComment, ForumPost } from '../types/community';
import { showConfirmAlert, showErrorAlert, showSuccessAlert } from '../utils/alert';

export default function PostDetailPage() {
  const navigate = useNavigate();
  const { postId } = useParams();
  const id = Number(postId);
  const [post, setPost] = useState<ForumPost | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [liked, setLiked] = useState(false);
  const [commentValue, setCommentValue] = useState('');
  const [replyValue, setReplyValue] = useState('');
  const [replyParentId, setReplyParentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currentUserEmail = localStorage.getItem('email') || '';

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const [nextPost, nextComments, likeStatus] = await Promise.all([getPost(id), getComments(id), getLikeStatus(id)]);
      setPost(nextPost);
      setComments(nextComments);
      setLiked(likeStatus.liked);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '게시글을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const refresh = async () => {
    const [nextPost, nextComments] = await Promise.all([getPost(id), getComments(id)]);
    setPost(nextPost);
    setComments(nextComments);
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!commentValue.trim()) return;
    await createComment(id, { content: commentValue.trim(), parentId: null });
    setCommentValue('');
    await refresh();
  };

  const submitReply = async (event: FormEvent<HTMLFormElement>, parentId: number) => {
    event.preventDefault();
    if (!replyValue.trim()) return;
    await createComment(id, { content: replyValue.trim(), parentId });
    setReplyValue('');
    setReplyParentId(null);
    await refresh();
  };

  const removeComment = async (commentId: number, isReply = false) => {
    const confirmed = await showConfirmAlert({ title: `${isReply ? '답글' : '댓글'}을 삭제하시겠습니까?`, text: '삭제한 내용은 복구할 수 없습니다.', confirmText: '삭제', cancelText: '취소', danger: true });
    if (!confirmed) return;
    try {
      await deleteComment(commentId);
      await refresh();
      await showSuccessAlert('삭제 완료', `${isReply ? '답글' : '댓글'}이 삭제되었습니다.`);
    } catch (deleteError) {
      await showErrorAlert('삭제 실패', deleteError instanceof Error ? deleteError.message : '삭제 중 오류가 발생했습니다.');
    }
  };

  if (loading) return <div className="community-page"><EmptyState title="게시글을 불러오는 중입니다." description="잠시만 기다려 주세요." aria-live="polite" /></div>;
  if (error || !post) return <div className="community-page"><EmptyState title={error || '게시글을 찾을 수 없습니다.'} action={<Button variant="secondary" onClick={() => navigate('/community')}>목록으로</Button>} /></div>;
  const isOwner = currentUserEmail.trim().toLowerCase() === (post.writerEmail || post.email || '').trim().toLowerCase();

  return (
    <div className="community-page">
      <Button variant="secondary" onClick={() => navigate('/community')}>← 게시판 목록으로</Button>
      <ForumPostDetail
        post={post}
        liked={liked}
        onLike={() => void likePost(id).then((result) => { setLiked(result.liked); setPost({ ...post, likeCount: result.likeCount }); })}
        onEdit={isOwner ? () => navigate(`/community/${id}/edit`) : undefined}
        onDelete={isOwner ? () => void showConfirmAlert({ title: '게시글을 삭제하시겠습니까?', text: '댓글과 좋아요 정보도 함께 삭제됩니다.', confirmText: '삭제', cancelText: '취소', danger: true }).then(async (confirmed) => { if (confirmed) { await deletePost(id); navigate('/community'); } }) : undefined}
      />
      <ForumCommentThread
        comments={comments}
        currentUserEmail={currentUserEmail}
        value={commentValue}
        replyValue={replyValue}
        replyParentId={replyParentId}
        onValueChange={setCommentValue}
        onReplyValueChange={setReplyValue}
        onSubmit={submitComment}
        onSubmitReply={submitReply}
        onToggleReply={(nextId) => { setReplyParentId(nextId); setReplyValue(''); }}
        onDelete={(commentId, isReply) => void removeComment(commentId, isReply)}
      />
    </div>
  );
}
