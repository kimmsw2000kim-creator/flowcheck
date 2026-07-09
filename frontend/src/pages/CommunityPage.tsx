import React, { useEffect, useState } from "react";
import { AlertCircle, MessageCircle, Share2, ThumbsUp } from "lucide-react";
import {
  createComment,
  createPost,
  getComments,
  getPosts,
  likePost,
} from "../api/communityApi.ts";

interface Post {
  id: number;
  title: string;
  content: string;
  promoUrl?: string;
  userId?: string;
  email?: string;
  writerEmail?: string;
  likes?: number;
  likeCount?: number;
  shares?: number;
  createdAt: string;
  commentCount?: number;
}

interface Comment {
  id: number;
  postId?: number;
  userId?: string;
  author?: string;
  writerEmail?: string;
  content: string;
  parentId: number | null;
  createdAt: string;
  replies?: Comment[];
}

interface LedgerItem {
  id: number;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

import { useUserStore } from '../store/userStore';
import { useAlertStore } from '../store/alertStore';

interface CommunityPageProps {
  ledger: LedgerItem[];
  onAddLedger: (ledgerItem: LedgerItem) => void;
  handleSubmitReport: (type: string, id: number) => void;
}

export default function CommunityPage({
  ledger,
  onAddLedger,
  handleSubmitReport
}: CommunityPageProps) {
  const currentUser = useUserStore((state) => state.currentUser);
  const onUserUpdate = useUserStore((state) => state.updateUserBalanceAndCoupons);
  const showAlert = useAlertStore((state) => state.showAlert);
  const [posts, setPosts] = useState<Post[]>([
    { id: 1, title: 'AI 이커머스 결제 프로세스 최적화 피드백을 부탁드립니다!', content: 'Gemini 추천 엔진을 바탕으로 장바구니 결제 프로세스를 리뉴얼했습니다. 고부하 상황에서의 응답 지연이나 UI/UX 측면에서의 개선 아이디어에 대해 부하 테스트 결과 및 피드백을 남겨주시면 감사하겠습니다.', promoUrl: '', userId: 'f87a32d1-921c-4b9b-90f3-cb2071850123', email: 'corp-user@flowcheck.com', likes: 12, shares: 4, createdAt: '2026-06-29' }
  ]);
  const [activePost, setActivePost] = useState<Post | { id: string } | null>(null);
  const [newPostTitle, setNewPostTitle] = useState<string>('');
  const [newPostContent, setNewPostContent] = useState<string>('');
  const [newPostPromoUrl, setNewPostPromoUrl] = useState<string>('');

  const [newCommentContent, setNewCommentContent] = useState("");
  const [replyParentId, setReplyParentId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    loadPosts();
  }, [page]);

  useEffect(() => {
    if (activePost && activePost.id !== "new") {
      loadComments(activePost.id);
    }
  }, [activePost]);

  const loadPosts = async () => {
    try {
      const data = await getPosts(page - 1, pageSize);

      if (Array.isArray(data)) {
        setPosts(data);
        setTotalPages(1);
      } else {
        setPosts(data.content || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (error) {
      console.error(error);
      showAlert("게시글 목록을 불러오지 못했습니다.", "error");
    }
  };

  const loadComments = async (postId: number) => {
    try {
      const data = await getComments(postId);
      setComments(data || []);
    } catch (error) {
      console.error(error);
      showAlert("댓글을 불러오지 못했습니다.", "error");
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPostTitle.trim() || !newPostContent.trim()) return;

    try {
      await createPost({
        title: newPostTitle,
        content: newPostContent,
        promoUrl: newPostPromoUrl,
      });

      const duplicate = ledger.some((l) => l.type === "REWARD_POST");

      if (!duplicate) {
        onUserUpdate({
          balance: currentUser.balance + 20000,
          coupons: currentUser.coupons,
        });

        onAddLedger({
          id: ledger.length + 1,
          amount: 20000,
          type: "REWARD_POST",
          description: "홍보 게시판 첫 글 등록 보상",
          createdAt: new Date().toISOString().substring(0, 16),
        });

        showAlert(
          "첫 홍보글이 등록되었습니다! 20,000 크레딧이 지급되었습니다!",
          "success"
        );
      } else {
        showAlert("홍보글이 등록되었습니다.", "success");
      }

      setNewPostTitle("");
      setNewPostContent("");
      setNewPostPromoUrl("");
      setActivePost(null);
      loadPosts();
    } catch (error) {
      console.error(error);
      showAlert("게시글 작성에 실패했습니다.", "error");
    }
  };

  const handleLikePost = async (postId: number) => {
    try {
      await likePost(postId);

      if (
        !ledger.some(
          (l) =>
            l.type === "REWARD_LIKE" &&
            l.description.includes(`게시글: ${postId}`)
        )
      ) {
        onUserUpdate({
          balance: currentUser.balance + 1000,
          coupons: currentUser.coupons,
        });

        onAddLedger({
          id: ledger.length + 1,
          amount: 1000,
          type: "REWARD_LIKE",
          description: `게시글: ${postId} 좋아요 리워드`,
          createdAt: new Date().toISOString().substring(0, 16),
        });

        showAlert("좋아요를 눌렀습니다! 1,000 크레딧이 지급되었습니다.", "success");
      } else {
        showAlert("좋아요를 눌렀습니다.", "success");
      }

      loadPosts();

      if (activePost && activePost.id !== "new" && activePost.id === postId) {
        setActivePost({
          ...activePost,
          likeCount: (activePost.likeCount || activePost.likes || 0) + 1,
          likes: (activePost.likes || activePost.likeCount || 0) + 1,
        });
      }
    } catch (error) {
      console.error(error);
      showAlert("좋아요 처리에 실패했습니다.", "error");
    }
  };

  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCommentContent.trim()) return;
    if (!activePost || activePost.id === "new") return;

    try {
      await createComment(activePost.id, {
        content: newCommentContent,
        parentId: replyParentId,
      });

      const duplicateCommentReward = ledger.some(
        (l) =>
          l.type === "REWARD_COMMENT" &&
          l.description.includes(`게시글: ${activePost.id}`)
      );

      if (!duplicateCommentReward && replyParentId === null) {
        onUserUpdate({
          balance: currentUser.balance + 5000,
          coupons: currentUser.coupons,
        });

        onAddLedger({
          id: ledger.length + 1,
          amount: 5000,
          type: "REWARD_COMMENT",
          description: `게시글: ${activePost.id} 첫 피드백 댓글 리워드`,
          createdAt: new Date().toISOString().substring(0, 16),
        });

        showAlert(
          "피드백 댓글이 등록되었습니다! 5,000 크레딧이 지급되었습니다!",
          "success"
        );
      } else {
        showAlert("댓글이 등록되었습니다.", "success");
      }

      setNewCommentContent("");
      setReplyParentId(null);
      loadComments(activePost.id);
      loadPosts();
    } catch (error) {
      console.error(error);
      showAlert("댓글 작성에 실패했습니다.", "error");
    }
  };

  const handleSharePost = (postId: number) => {
    showAlert(`게시글 ${postId} 공유 기능은 추후 연결하면 됩니다.`, "success");
  };

  const getWriter = (post: Post) => {
    return post.writerEmail || post.email || "unknown";
  };

  const getLikeCount = (post: Post) => {
    return post.likeCount ?? post.likes ?? 0;
  };

  const getPageNumbers = () => {
    const start = Math.floor((page - 1) / 10) * 10 + 1;
    const end = Math.min(start + 9, totalPages);

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const visibleComments = comments.filter((comment) => comment.parentId === null);

  return (
    <div style={{ textAlign: "left" }}>
      {activePost && activePost.id !== "new" ? (
        <div>
          <button
            className="btn btn-secondary"
            style={{ marginBottom: "1.5rem" }}
            onClick={() => {
              setActivePost(null);
              setReplyParentId(null);
            }}
          >
            &larr; 게시판 목록으로 돌아가기
          </button>

          <div className="card">
            <div className="post-header">
              <span>작성자: {getWriter(activePost)}</span>
              <span>{activePost.createdAt?.slice(0, 10)}</span>
            </div>

            <h2 style={{ marginBottom: "1rem", fontSize: "1.5rem" }}>
              {activePost.title}
            </h2>

            <p
              style={{
                fontSize: "1.05rem",
                lineHeight: 1.6,
                marginBottom: "1.5rem",
                whiteSpace: "pre-wrap",
              }}
            >
              {activePost.content}
            </p>

            {activePost.promoUrl && (
              <div
                style={{
                  marginBottom: "1.5rem",
                  padding: "0.75rem",
                  background: "var(--bg-tertiary)",
                  borderRadius: "0.5rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>
                  프로모션 링크:{" "}
                  <a
                    href={activePost.promoUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "var(--accent-hover)",
                      fontFamily: "var(--mono)",
                    }}
                  >
                    {activePost.promoUrl}
                  </a>
                </span>

                <button
                  className="btn btn-secondary"
                  style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
                  onClick={() => handleSharePost(activePost.id)}
                >
                  <Share2 size={14} /> 링크 공유하기
                </button>
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: "1.5rem",
                borderTop: "1px solid var(--border)",
                paddingTop: "1rem",
              }}
            >
              <button
                className="post-action-btn"
                onClick={() => handleLikePost(activePost.id)}
              >
                <ThumbsUp size={16} /> 좋아요 ({getLikeCount(activePost)})
              </button>

              <button
                className="post-action-btn"
                onClick={() => handleSubmitReport("POST", activePost.id)}
              >
                <AlertCircle size={16} /> 게시글 신고
              </button>
            </div>
          </div>

          <div className="comment-section">
            <h3>피드백 및 댓글</h3>

            {replyParentId && (
              <p style={{ color: "var(--accent-hover)", marginTop: "1rem" }}>
                댓글 #{replyParentId}에 답글 작성 중
              </p>
            )}

            <form
              onSubmit={handleCreateComment}
              style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}
            >
              <div className="form-group">
                <textarea
                  className="form-input"
                  placeholder={
                    replyParentId
                      ? "답글 피드백을 작성하세요..."
                      : "UX 피드백 댓글을 입력하세요..."
                  }
                  value={newCommentContent}
                  onChange={(e) => setNewCommentContent(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="submit" className="btn btn-primary">
                  {replyParentId ? "답글 등록" : "피드백 등록"}
                </button>

                {replyParentId && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setReplyParentId(null)}
                  >
                    답글 취소
                  </button>
                )}
              </div>
            </form>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {visibleComments.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--text-muted)",
                    padding: "2rem",
                  }}
                >
                  아직 댓글이 없습니다.
                </div>
              )}

              {visibleComments.map((comment) => (
                <div key={comment.id}>
                  <div className="comment-card">
                    <span className="comment-author">
                      {comment.writerEmail || comment.author || "unknown"}
                    </span>

                    <p className="comment-content">{comment.content}</p>

                    <div className="comment-footer">
                      <span>{comment.createdAt?.slice(0, 16)}</span>

                      <button
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--accent-hover)",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                        onClick={() => setReplyParentId(comment.id)}
                      >
                        답글
                      </button>

                      <button
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                        onClick={() => handleSubmitReport("COMMENT", comment.id)}
                      >
                        신고
                      </button>
                    </div>
                  </div>

                  {(comment.replies || []).map((reply) => (
                    <div key={reply.id} className="comment-card reply">
                      <span className="comment-author">
                        ㄴ {reply.writerEmail || reply.author || "unknown"}
                      </span>

                      <p className="comment-content">{reply.content}</p>

                      <div className="comment-footer">
                        <span>{reply.createdAt?.slice(0, 16)}</span>

                        <button
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                          }}
                          onClick={() => handleSubmitReport("COMMENT", reply.id)}
                        >
                          신고
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
            }}
          >
            <div>
              <h2 style={{ fontSize: "1.75rem" }}>프로모션 피드백 게시판</h2>

              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                내 서비스를 홍보하고 UI 테스트용 크레딧을 획득하세요.
              </p>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => setActivePost({ id: "new" })}
            >
              홍보 게시글 작성
            </button>
          </div>

          {activePost && activePost.id === "new" ? (
            <div className="card">
              <h3 style={{ marginBottom: "1.25rem" }}>
                새로운 프로모션 게시글 등록
              </h3>

              <form onSubmit={handleCreatePost}>
                <div className="form-group">
                  <label className="form-label">제목</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="서비스를 소개할 제목을 입력하세요..."
                    value={newPostTitle}
                    onChange={(e) => setNewPostTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">서비스 주소 URL</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://example.com"
                    value={newPostPromoUrl}
                    onChange={(e) => setNewPostPromoUrl(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">상세 내용</label>
                  <textarea
                    className="form-input"
                    rows={6}
                    placeholder="검증받고 싶은 UI/UX 피드백 내용을 적어주세요..."
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                  <button type="submit" className="btn btn-primary">
                    게시글 발행
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setActivePost(null)}
                  >
                    취소
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <div className="post-list">
                {posts.map((post) => (
                  <div
                    className="post-card"
                    key={post.id}
                    onClick={() => setActivePost(post)}
                  >
                    <div className="post-header">
                      <span>작성자: {getWriter(post)}</span>
                      <span>{post.createdAt?.slice(0, 10)}</span>
                    </div>

                    <h4 className="post-title">
                      {post.title}
                      {(post.commentCount || 0) > 0 && (
                        <span style={{ marginLeft: "0.5rem", color: "#0070c9" }}>
                          [{post.commentCount}]
                        </span>
                      )}
                    </h4>

                    <p className="post-snippet">
                      {post.content?.length > 150
                        ? `${post.content.substring(0, 150)}...`
                        : post.content}
                    </p>

                    <div className="post-actions">
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                      >
                        <ThumbsUp size={14} /> {getLikeCount(post)} 좋아요
                      </span>

                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                      >
                        <MessageCircle size={14} /> {post.commentCount || 0} 댓글
                      </span>

                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                      >
                        <Share2 size={14} /> {post.shares || 0} 공유
                      </span>
                    </div>
                  </div>
                ))}

                {posts.length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      color: "var(--text-muted)",
                      padding: "3rem",
                    }}
                  >
                    아직 등록된 홍보글이 없습니다.
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "0.4rem",
                  marginTop: "1.5rem",
                }}
              >
                <button
                  className="btn btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  이전
                </button>

                {getPageNumbers().map((num) => (
                  <button
                    key={num}
                    className={page === num ? "btn btn-primary" : "btn btn-secondary"}
                    onClick={() => setPage(num)}
                  >
                    {num}
                  </button>
                ))}

                <button
                  className="btn btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  다음
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}