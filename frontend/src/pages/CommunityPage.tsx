import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { MessageCircle, Share2, ThumbsUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  createComment,
  createPost,
  deleteComment,
  deletePost,
  getComments,
  getLikeStatus,
  getPost,
  getPosts,
  likePost,
} from '../api/communityApi';
import { Badge, Button, Card, EmptyState, Field, PageHeader } from '../components/common';
import {
  ForumCommentThread,
  ForumPostDetail,
  PostEditorForm,
  getForumLikeCount,
  getForumWriter,
} from '../components/community';
import { useLedgerStore } from '../store/ledgerStore';
import { useUserStore } from '../store/userStore';
import type { ForumComment, ForumPost } from '../types/community';
import { showConfirmAlert, showWarningAlert } from '../utils/alert';

interface CommunityPageProps {
  currentUser: { id: string; email: string; balance: number; coupons: number };
  showAlert: (message: string, type?: string) => void;
  handleSubmitReport: (type: string, id: number) => void;
}

export default function CommunityPage({ currentUser, showAlert, handleSubmitReport }: CommunityPageProps) {
  const navigate = useNavigate();
  const ledger = useLedgerStore((state) => state.entries);
  const addOptimisticReward = useLedgerStore((state) => state.addOptimisticReward);
  const updateUser = useUserStore((state) => state.updateUserBalanceAndCoupons);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [activePost, setActivePost] = useState<ForumPost | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [liked, setLiked] = useState(false);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [commentValue, setCommentValue] = useState('');
  const [replyValue, setReplyValue] = useState('');
  const [replyParentId, setReplyParentId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getPosts(page - 1, 10, keyword);
      setPosts(Array.isArray(data) ? data : data.content || []);
      setTotalPages(Array.isArray(data) ? 1 : data.totalPages || 1);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : '게시글 목록을 불러오지 못했습니다.';
      setError(message);
      showAlert(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [keyword, page, showAlert]);

  useEffect(() => { void loadPosts(); }, [loadPosts]);

  const openPost = async (postId: number) => {
    try {
      const [post, postComments, likeStatus] = await Promise.all([
        getPost(postId), getComments(postId), getLikeStatus(postId),
      ]);
      setActivePost(post);
      setComments(postComments);
      setLiked(likeStatus.liked);
    } catch (openError) {
      showAlert(openError instanceof Error ? openError.message : '게시글을 불러오지 못했습니다.', 'error');
    }
  };

  const refreshDetail = async (postId: number) => {
    const [post, postComments] = await Promise.all([getPost(postId), getComments(postId)]);
    setActivePost(post);
    setComments(postComments);
    await loadPosts();
  };

  const createPromotion = async (value: { title: string; content: string; promoUrl?: string }) => {
    try {
      setSubmitting(true);
      await createPost(value);
      if (!ledger.some((entry) => entry.type === 'REWARD_POST')) {
        updateUser({ balance: currentUser.balance + 20000, coupons: currentUser.coupons });
        addOptimisticReward({ amount: 20000, type: 'REWARD_POST', description: '홍보 게시판 첫 글 등록 보상' });
        showAlert('첫 홍보글이 등록되어 20,000 크레딧이 지급되었습니다.', 'success');
      } else {
        showAlert('홍보글이 등록되었습니다.', 'success');
      }
      setCreating(false);
      await loadPosts();
    } catch (createError) {
      showAlert(createError instanceof Error ? createError.message : '게시글 작성에 실패했습니다.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLike = async () => {
    if (!activePost) return;
    try {
      const result = await likePost(activePost.id);
      setLiked(result.liked);
      setActivePost({ ...activePost, likeCount: result.likeCount, likes: result.likeCount });
      setPosts((items) => items.map((post) => post.id === activePost.id ? { ...post, likeCount: result.likeCount, likes: result.likeCount } : post));
      showAlert(result.liked ? '좋아요를 눌렀습니다.' : '좋아요를 취소했습니다.', result.liked ? 'success' : 'info');
    } catch (likeError) {
      showAlert(likeError instanceof Error ? likeError.message : '좋아요 처리에 실패했습니다.', 'error');
    }
  };

  const checkOwner = async () => {
    if (!activePost) return false;
    const isOwner = currentUser.email.trim().toLowerCase() === getForumWriter(activePost).trim().toLowerCase();
    if (!isOwner) await showWarningAlert('권한이 없습니다.', '본인이 작성한 게시글만 변경할 수 있습니다.');
    return isOwner;
  };

  const removePost = async () => {
    if (!activePost || !(await checkOwner())) return;
    const confirmed = await showConfirmAlert({ title: '게시글을 삭제하시겠습니까?', text: '댓글과 좋아요 정보도 함께 삭제됩니다.', confirmText: '삭제', cancelText: '취소', danger: true });
    if (!confirmed) return;
    try {
      await deletePost(activePost.id);
      setActivePost(null);
      setComments([]);
      await loadPosts();
      showAlert('게시글이 삭제되었습니다.', 'success');
    } catch (deleteError) {
      showAlert(deleteError instanceof Error ? deleteError.message : '게시글 삭제에 실패했습니다.', 'error');
    }
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activePost || !commentValue.trim()) return;
    try {
      await createComment(activePost.id, { content: commentValue.trim(), parentId: null });
      if (!ledger.some((entry) => entry.type === 'REWARD_COMMENT' && entry.description.includes(`게시글: ${activePost.id}`))) {
        updateUser({ balance: currentUser.balance + 5000, coupons: currentUser.coupons });
        addOptimisticReward({ amount: 5000, type: 'REWARD_COMMENT', description: `게시글: ${activePost.id} 첫 피드백 댓글 리워드` });
        showAlert('피드백 댓글이 등록되어 5,000 크레딧이 지급되었습니다.', 'success');
      } else {
        showAlert('댓글이 등록되었습니다.', 'success');
      }
      setCommentValue('');
      await refreshDetail(activePost.id);
    } catch (commentError) {
      showAlert(commentError instanceof Error ? commentError.message : '댓글 작성에 실패했습니다.', 'error');
    }
  };

  const submitReply = async (event: FormEvent<HTMLFormElement>, parentId: number) => {
    event.preventDefault();
    if (!activePost || !replyValue.trim()) return;
    try {
      await createComment(activePost.id, { content: replyValue.trim(), parentId });
      setReplyValue('');
      setReplyParentId(null);
      await refreshDetail(activePost.id);
      showAlert('답글이 등록되었습니다.', 'success');
    } catch (replyError) {
      showAlert(replyError instanceof Error ? replyError.message : '답글 작성에 실패했습니다.', 'error');
    }
  };

  const removeComment = async (commentId: number, isReply = false) => {
    if (!activePost) return;
    const confirmed = await showConfirmAlert({ title: `${isReply ? '답글' : '댓글'}을 삭제하시겠습니까?`, text: '삭제한 내용은 복구할 수 없습니다.', confirmText: '삭제', cancelText: '취소', danger: true });
    if (!confirmed) return;
    try {
      await deleteComment(commentId);
      await refreshDetail(activePost.id);
      showAlert(`${isReply ? '답글' : '댓글'}이 삭제되었습니다.`, 'success');
    } catch (deleteError) {
      showAlert(deleteError instanceof Error ? deleteError.message : '댓글 삭제에 실패했습니다.', 'error');
    }
  };

  const pageNumbers = Array.from({ length: Math.min(10, totalPages) }, (_, index) => Math.floor((page - 1) / 10) * 10 + index + 1).filter((number) => number <= totalPages);

  if (activePost) {
    return (
      <div className="community-page">
        <Button variant="secondary" onClick={() => { setActivePost(null); setReplyParentId(null); }}>← 게시판 목록으로</Button>
        <ForumPostDetail
          post={activePost}
          liked={liked}
          feedbackLabel="피드백"
          onLike={() => void toggleLike()}
          onEdit={() => void checkOwner().then((allowed) => allowed && navigate(`/community/${activePost.id}/edit`))}
          onDelete={() => void removePost()}
          onReport={() => handleSubmitReport('POST', activePost.id)}
          onShare={() => showAlert(`게시글 ${activePost.id} 공유 기능은 추후 연결될 예정입니다.`, 'info')}
        />
        <ForumCommentThread
          comments={comments}
          currentUserEmail={currentUser.email}
          value={commentValue}
          replyValue={replyValue}
          replyParentId={replyParentId}
          label="피드백 및 댓글"
          onValueChange={setCommentValue}
          onReplyValueChange={setReplyValue}
          onSubmit={submitComment}
          onSubmitReply={submitReply}
          onToggleReply={(id) => { setReplyParentId(id); setReplyValue(''); }}
          onDelete={(id, reply) => void removeComment(id, reply)}
          onReport={(id) => handleSubmitReport('COMMENT', id)}
        />
      </div>
    );
  }

  return (
    <div className="community-page">
      <PageHeader
        eyebrow="Community"
        title="프로모션 피드백 게시판"
        description="서비스를 소개하고 사용자에게 UI/UX 피드백을 받아보세요."
        actions={<Button onClick={() => setCreating(true)}>홍보 게시글 작성</Button>}
      />

      <form className="community-search" onSubmit={(event) => { event.preventDefault(); setPage(1); setKeyword(searchInput.trim()); }} role="search">
        <Field label="게시글 검색" htmlFor="community-search-input">
          <input id="community-search-input" className="fc-input form-input" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="제목 또는 작성자 이메일" />
        </Field>
        <Button type="submit">검색</Button>
        {keyword && <Button type="button" variant="secondary" onClick={() => { setSearchInput(''); setKeyword(''); setPage(1); }}>초기화</Button>}
      </form>

      {creating && <PostEditorForm mode="create" showPromoUrl submitting={submitting} onSubmit={createPromotion} onCancel={() => setCreating(false)} />}
      {loading && <EmptyState title="게시글을 불러오는 중입니다." description="잠시만 기다려 주세요." aria-live="polite" />}
      {!loading && error && <EmptyState title={error} action={<Button variant="secondary" onClick={() => void loadPosts()}>다시 시도</Button>} />}
      {!loading && !error && posts.length === 0 && <EmptyState title={keyword ? '검색 결과가 없습니다.' : '등록된 홍보글이 없습니다.'} description="첫 번째 게시글을 작성해 보세요." />}
      {!loading && !error && posts.length > 0 && (
        <div className="community-post-grid">
          {posts.map((post) => (
            <Card as="article" key={post.id} interactive className="community-post-card">
              <button type="button" className="community-post-card__link" onClick={() => void openPost(post.id)} aria-label={`${post.title} 상세 보기`} />
              <div className="community-post-meta"><span>{getForumWriter(post)}</span><time>{post.createdAt?.slice(0, 10)}</time></div>
              <h2>{post.title} {(post.commentCount ?? 0) > 0 && <Badge tone="info">{post.commentCount}</Badge>}</h2>
              <p>{post.content?.length > 150 ? `${post.content.slice(0, 150)}…` : post.content}</p>
              <div className="community-post-stats">
                <span><ThumbsUp size={14} aria-hidden="true" /> {getForumLikeCount(post)}</span>
                <span><MessageCircle size={14} aria-hidden="true" /> {post.commentCount ?? 0}</span>
                <span><Share2 size={14} aria-hidden="true" /> {post.shares ?? 0}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <nav className="community-pagination" aria-label="게시글 페이지">
          <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>이전</Button>
          {pageNumbers.map((number) => <Button key={number} variant={page === number ? 'primary' : 'secondary'} size="sm" aria-current={page === number ? 'page' : undefined} onClick={() => setPage(number)}>{number}</Button>)}
          <Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => setPage((value) => value + 1)}>다음</Button>
        </nav>
      )}
    </div>
  );
}
