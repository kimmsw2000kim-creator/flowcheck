import React, { useState } from 'react';
import { ThumbsUp, Share2, AlertCircle } from 'lucide-react';

interface Post {
  id: number;
  title: string;
  content: string;
  promoUrl: string;
  userId: string;
  email: string;
  likes: number;
  shares: number;
  createdAt: string;
}

interface Comment {
  id: number;
  postId: number;
  userId: string;
  author: string;
  content: string;
  parentId: number | null;
  createdAt: string;
}

interface LedgerItem {
  id: number;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

interface CommunityPageProps {
  currentUser: {
    id: string;
    email: string;
    balance: number;
    coupons: number;
  };
  onUserUpdate: (updatedUser: { balance: number; coupons: number }) => void;
  ledger: LedgerItem[];
  onAddLedger: (ledgerItem: LedgerItem) => void;
  showAlert: (message: string, type?: string) => void;
  handleSubmitReport: (type: string, id: number) => void;
}

export default function CommunityPage({
  currentUser,
  onUserUpdate,
  ledger,
  onAddLedger,
  showAlert,
  handleSubmitReport
}: CommunityPageProps) {
  const [posts, setPosts] = useState<Post[]>([
    { id: 1, title: 'AI 이커머스 결제 프로세스 최적화 피드백을 부탁드립니다!', content: 'Gemini 추천 엔진을 바탕으로 장바구니 결제 프로세스를 리뉴얼했습니다. 고부하 상황에서의 응답 지연이나 UI/UX 측면에서의 개선 아이디어에 대해 부하 테스트 결과 및 피드백을 남겨주시면 감사하겠습니다.', promoUrl: 'https://myshop.com', userId: 'f87a32d1-921c-4b9b-90f3-cb2071850123', email: 'corp-user@flowcheck.com', likes: 12, shares: 4, createdAt: '2026-06-29' }
  ]);
  const [activePost, setActivePost] = useState<Post | { id: string } | null>(null);
  const [newPostTitle, setNewPostTitle] = useState<string>('');
  const [newPostContent, setNewPostContent] = useState<string>('');
  const [newPostPromoUrl, setNewPostPromoUrl] = useState<string>('');

  const [comments, setComments] = useState<Comment[]>([
    { id: 1, postId: 1, userId: 'd290f1e2-b8b8-4d56-bc9b-3e5f6e872111', author: 'tester1@flowcheck.io', content: '크롤링 및 AI 분석 속도는 매우 매끄러웠으나, 결제 폼에서 입력 파라미터 유효성 검증이 다소 미흡하게 통과되는 현상이 식별되었습니다.', parentId: null, createdAt: '2026-06-29 18:00' }
  ]);
  const [newCommentContent, setNewCommentContent] = useState<string>('');
  const [replyParentId, setReplyParentId] = useState<number | null>(null);

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle || !newPostContent) return;
    const duplicate = posts.some(p => p.userId === currentUser.id);
    const newPost: Post = {
      id: posts.length + 1,
      title: newPostTitle,
      content: newPostContent,
      promoUrl: newPostPromoUrl,
      userId: currentUser.id,
      email: currentUser.email,
      likes: 0,
      shares: 0,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setPosts([newPost, ...posts]);
    setNewPostTitle('');
    setNewPostContent('');
    setNewPostPromoUrl('');

    if (!duplicate) {
      onUserUpdate({
        balance: currentUser.balance + 20000,
        coupons: currentUser.coupons
      });
      onAddLedger({
        id: ledger.length + 1,
        amount: 20000,
        type: 'REWARD_POST',
        description: '홍보 게시판 첫 글 등록 보상',
        createdAt: new Date().toISOString().substring(0, 16)
      });
      showAlert('첫 홍보글이 등록되었습니다! 20,000 크레딧이 지급되었습니다!', 'success');
    } else {
      showAlert('홍보글이 성공적으로 등록되었습니다.');
    }
  };

  const handleLikePost = (postId: number) => {
    if (ledger.some(l => l.type === 'REWARD_LIKE' && l.description.includes(`게시글: ${postId}`))) {
      showAlert('이미 좋아요를 누른 게시글입니다. 중복 리워드 지급이 차단되었습니다.', 'warning');
      return;
    }
    setPosts(posts.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p));
    onUserUpdate({
      balance: currentUser.balance + 1000,
      coupons: currentUser.coupons
    });
    onAddLedger({
      id: ledger.length + 1,
      amount: 1000,
      type: 'REWARD_LIKE',
      description: `게시글: ${postId} 좋아요 리워드`,
      createdAt: new Date().toISOString().substring(0, 16)
    });
    showAlert('게시글에 좋아요를 눌렀습니다! 1,000 크레딧이 지급되었습니다.', 'success');
  };

  const handleSharePost = (postId: number) => {
    if (ledger.some(l => l.type === 'REWARD_SHARE' && l.description.includes(`게시글: ${postId}`))) {
      showAlert('이미 공유한 게시글입니다. 중복 리워드 지급이 차단되었습니다.', 'warning');
      return;
    }
    setPosts(posts.map(p => p.id === postId ? { ...p, shares: p.shares + 1 } : p));
    onUserUpdate({
      balance: currentUser.balance + 2000,
      coupons: currentUser.coupons
    });
    onAddLedger({
      id: ledger.length + 1,
      amount: 2000,
      type: 'REWARD_SHARE',
      description: `게시글: ${postId} 공유 리워드`,
      createdAt: new Date().toISOString().substring(0, 16)
    });
    showAlert('게시글이 공유되었습니다! 2,000 크레딧이 지급되었습니다.', 'success');
  };

  const handleCreateComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentContent || !activePost) return;
    const duplicateCommentReward = ledger.some(l => l.type === 'REWARD_COMMENT' && l.description.includes(`게시글: ${activePost.id}`));
    const newComment: Comment = {
      id: comments.length + 1,
      postId: typeof activePost.id === 'string' ? 0 : activePost.id,
      userId: currentUser.id,
      author: currentUser.email,
      content: newCommentContent,
      parentId: replyParentId,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    setComments([...comments, newComment]);
    setNewCommentContent('');
    setReplyParentId(null);

    if (!duplicateCommentReward) {
      onUserUpdate({
        balance: currentUser.balance + 5000,
        coupons: currentUser.coupons
      });
      onAddLedger({
        id: ledger.length + 1,
        amount: 5000,
        type: 'REWARD_COMMENT',
        description: `게시글: ${activePost.id} 첫 피드백 댓글 리워드`,
        createdAt: new Date().toISOString().substring(0, 16)
      });
      showAlert('피드백 댓글이 등록되었습니다! 5,000 크레딧이 지급되었습니다!', 'success');
    } else {
      showAlert('댓글이 등록되었습니다.');
    }
  };
  return (
    <div style={{ textAlign: 'left' }}>
      {activePost && activePost.id !== 'new' ? (
        // Post details with nested comments tree
        <div>
          <button className="btn btn-secondary" style={{ marginBottom: '1.5rem' }} onClick={() => setActivePost(null)}>
            &larr; 게시판 목록으로 돌아가기
          </button>

          <div className="card">
            <div className="post-header">
              <span>작성자: {(activePost as Post).email}</span>
              <span>{(activePost as Post).createdAt}</span>
            </div>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>{(activePost as Post).title}</h2>
            <p style={{ fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '1.5rem', whiteSpace: 'pre-wrap' }}>
              {(activePost as Post).content}
            </p>
            
            {(activePost as Post).promoUrl && (
              <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>프로모션 링크: <a href={(activePost as Post).promoUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-hover)', fontFamily: 'var(--mono)' }}>{(activePost as Post).promoUrl}</a></span>
                <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }} onClick={() => handleSharePost((activePost as Post).id)}>
                  <Share2 size={14} /> 링크 공유하기
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <button className="post-action-btn" onClick={() => handleLikePost((activePost as Post).id)}>
                <ThumbsUp size={16} /> 좋아요 ({(activePost as Post).likes})
              </button>
              <button className="post-action-btn" onClick={() => handleSubmitReport('POST', (activePost as Post).id)}>
                <AlertCircle size={16} /> 게시글 신고
              </button>
            </div>
          </div>

          {/* Comment Section */}
          <div className="comment-section">
            <h3>피드백 및 댓글</h3>

            <form onSubmit={handleCreateComment} style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
              <div className="form-group">
                <textarea 
                  className="form-input" 
                  placeholder={replyParentId ? "답글 피드백을 작성하세요..." : "UX 피드백 댓글을 입력하세요 (첫 피드백 등록 시 5,000 크레딧 지급!)..."} 
                  value={newCommentContent} 
                  onChange={(e) => setNewCommentContent(e.target.value)}
                  required
                ></textarea>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">피드백 등록</button>
                {replyParentId && (
                  <button type="button" className="btn btn-secondary" onClick={() => setReplyParentId(null)}>답글 취소</button>
                )}
              </div>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {comments.filter(c => c.postId === (activePost as Post).id).map(c => (
                <div key={c.id}>
                  <div className={`comment-card ${c.parentId ? 'reply' : ''}`}>
                    <span className="comment-author">{c.author} {c.parentId && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(답글)</span>}</span>
                    <p className="comment-content">{c.content}</p>
                    <div className="comment-footer">
                      <span>{c.createdAt}</span>
                      {!c.parentId && (
                        <button style={{ background: 'transparent', border: 'none', color: 'var(--accent-hover)', cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => setReplyParentId(c.id)}>
                          답글
                        </button>
                      )}
                      <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => handleSubmitReport('COMMENT', c.id)}>
                        신고
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      ) : (

        // Promo Board list
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.75rem' }}>프로모션 피드백 게시판</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>내 서비스를 홍보하고 QA용 크레딧을 획득하세요. 첫 홍보글 작성 시 20,000 크레딧이 지급됩니다.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setActivePost({ id: 'new' })}>
              홍보 게시글 작성
            </button>
          </div>

          {activePost && activePost.id === 'new' ? (
            // Create post form
            <div className="card">
              <h3 style={{ marginBottom: '1.25rem' }}>새로운 프로모션 게시글 등록</h3>
              <form onSubmit={handleCreatePost}>
                <div className="form-group">
                  <label className="form-label">제목</label>
                  <input type="text" className="form-input" placeholder="서비스를 소개할 제목을 입력하세요..." value={newPostTitle} onChange={(e) => setNewPostTitle(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">서비스 주소 (URL)</label>
                  <input type="url" className="form-input" placeholder="Promotion Link (https://example.com)..." value={newPostPromoUrl} onChange={(e) => setNewPostPromoUrl(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">상세 내용</label>
                  <textarea className="form-input" rows={6} placeholder="사이트를 소개하고 중점적으로 검증받고 싶은 QA/UX 피드백 내용을 적어주세요..." value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} required></textarea>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary">게시글 발행</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActivePost(null)}>취소</button>
                </div>
              </form>
            </div>
          ) : (
            <div className="post-list">
              {posts.map(p => (
                <div className="post-card" key={p.id} onClick={() => setActivePost(p)}>
                  <div className="post-header">
                    <span>작성자: {p.email}</span>
                    <span>{p.createdAt}</span>
                  </div>
                  <h4 className="post-title">{p.title}</h4>
                  <p className="post-snippet">{p.content.substring(0, 150)}...</p>
                  <div className="post-actions">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><ThumbsUp size={14} /> {p.likes} 좋아요</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Share2 size={14} /> {p.shares} 공유</span>
                  </div>
                </div>
              ))}
              {posts.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>아직 등록된 홍보글이 없습니다. 첫 번째 홍보글을 올려보세요!</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
