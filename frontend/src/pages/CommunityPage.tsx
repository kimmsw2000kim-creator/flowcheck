import React, { useEffect, useState } from "react";
import { AlertCircle, MessageCircle, Share2, ThumbsUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  showConfirmAlert,
  showErrorAlert,
  showSuccessAlert,
  showWarningAlert,
  showToast,
} from "../utils/alert";
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
} from "../api/communityApi";

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

interface CommunityPageProps {
  currentUser: {
    id: string;
    email: string;
    balance: number;
    coupons: number;
  };
  onUserUpdate: (updatedUser: {
    balance: number;
    coupons: number;
  }) => void;
  ledger: LedgerItem[];
  onAddLedger: (ledgerItem: LedgerItem) => void;
  handleSubmitReport: (type: string, id: number) => void;
}

export default function CommunityPage({
  currentUser,
  onUserUpdate,
  ledger,
  onAddLedger,
  handleSubmitReport,
}: CommunityPageProps) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [activePost, setActivePost] = useState<Post | { id: "new" } | null>(
    null
  );

  const [comments, setComments] = useState<Comment[]>([]);

  const [liked, setLiked] = useState(false);

  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostPromoUrl, setNewPostPromoUrl] = useState("");

  const [newCommentContent, setNewCommentContent] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyParentId, setReplyParentId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");

  const pageSize = 10;

  useEffect(() => {
    loadPosts();
  }, [page, keyword]);

  useEffect(() => {
    if (activePost && activePost.id !== "new") {
      loadComments(activePost.id);
    }
  }, [activePost]);

  const loadPosts = async () => {
    try {
      const data = await getPosts(
        page - 1,
        pageSize,
        keyword
      );

      if (Array.isArray(data)) {
        setPosts(data);
        setTotalPages(1);
      } else {
        setPosts(data.content || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (error) {
      console.error(error);
      await showErrorAlert(
        "목록 조회 실패",
        "게시글 목록을 불러오지 못했습니다."
      );
    }
  };

  const handleSearch = (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setPage(1);
    setKeyword(searchInput.trim());
  };

  const handleResetSearch = () => {
    setSearchInput("");
    setKeyword("");
    setPage(1);
  };

  const loadComments = async (postId: number) => {
    try {
      const data = await getComments(postId);
      setComments(data || []);
    } catch (error) {
      console.error(error);
      await showErrorAlert(
        "댓글 조회 실패",
        "댓글을 불러오지 못했습니다."
      );
    }
  };

  const openPost = async (postId: number) => {
    try {
      const [postData, commentData, likeStatus] = await Promise.all([
        getPost(postId),
        getComments(postId),
        getLikeStatus(postId),
      ]);

      setActivePost(postData);
      setComments(commentData || []);
      setLiked(likeStatus.liked);
    } catch (error) {
      console.error("게시글 상세 조회 실패:", error);
      await showErrorAlert(
        "게시글 조회 실패",
        "게시글을 불러오지 못했습니다."
      );
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

        await showSuccessAlert(
          "게시글 등록 완료",
          "첫 홍보글 보상으로 20,000 크레딧이 지급되었습니다."
        );
      } else {
        await showSuccessAlert(
          "게시글 등록 완료",
          "홍보 게시글이 정상적으로 등록되었습니다."
        );
      }

      setNewPostTitle("");
      setNewPostContent("");
      setNewPostPromoUrl("");
      setActivePost(null);
      loadPosts();
    } catch (error) {
      console.error(error);
      await showErrorAlert(
        "게시글 등록 실패",
        error instanceof Error
          ? error.message
          : "게시글 작성 중 오류가 발생했습니다."
      );
    }
  };

  const handleLikePost = async (postId: number) => {
    try {
      const result = await likePost(postId);

      setLiked(result.liked);

      setActivePost((prev) => {
        if (!prev || prev.id === "new") return prev;

        return {
          ...prev,
          likeCount: result.likeCount,
          likes: result.likeCount,
        };
      });

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
              ...post,
              likeCount: result.likeCount,
              likes: result.likeCount,
            }
            : post
        )
      );

      await showToast(
        result.liked
          ? "좋아요를 눌렀습니다."
          : "좋아요를 취소했습니다.",
        result.liked ? "success" : "info"
      );
    } catch (error) {
      console.error("좋아요 처리 실패:", error);

      await showErrorAlert(
        "좋아요 처리 실패",
        error instanceof Error
          ? error.message
          : "좋아요 처리 중 오류가 발생했습니다."
      );
    }
  };

  const handleEditPost = async () => {
    if (!activePost || activePost.id === "new") return;

    const loginEmail = (currentUser.email || "")
      .trim()
      .toLowerCase();

    const writerEmail = (
      activePost.writerEmail ||
      activePost.email ||
      ""
    )
      .trim()
      .toLowerCase();

    if (!loginEmail || loginEmail !== writerEmail) {
      await showWarningAlert(
        "수정 권한이 없습니다.",
        "본인이 작성한 게시글만 수정할 수 있습니다."
      );
      return;
    }

    navigate(`/community/${activePost.id}/edit`);
  };

  const handleDeletePost = async () => {
    if (!activePost || activePost.id === "new") return;

    const loginEmail = (currentUser.email || "")
      .trim()
      .toLowerCase();

    const writerEmail = (
      activePost.writerEmail ||
      activePost.email ||
      ""
    )
      .trim()
      .toLowerCase();

    if (!loginEmail || loginEmail !== writerEmail) {
      await showWarningAlert(
        "삭제 권한이 없습니다.",
        "본인이 작성한 게시글만 삭제할 수 있습니다."
      );
      return;
    }

    const confirmed = await showConfirmAlert({
      title: "게시글을 삭제하시겠습니까?",
      text: "댓글과 좋아요 정보도 함께 삭제됩니다.",
      confirmText: "삭제",
      cancelText: "취소",
      danger: true,
    });

    if (!confirmed) return;

    try {
      await deletePost(activePost.id);

      setActivePost(null);
      setComments([]);
      setReplyParentId(null);
      setReplyText("");
      setLiked(false);

      await loadPosts();

      await showSuccessAlert(
        "삭제 완료",
        "게시글이 정상적으로 삭제되었습니다."
      );
    } catch (error) {
      console.error("게시글 삭제 실패:", error);

      await showErrorAlert(
        "삭제 실패",
        error instanceof Error
          ? error.message
          : "게시글 삭제 중 오류가 발생했습니다."
      );
    }
  };

  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCommentContent.trim()) return;
    if (!activePost || activePost.id === "new") return;

    try {
      await createComment(activePost.id, {
        content: newCommentContent,
        parentId: null,
      });

      const duplicateCommentReward = ledger.some(
        (l) =>
          l.type === "REWARD_COMMENT" &&
          l.description.includes(`게시글: ${activePost.id}`)
      );

      if (!duplicateCommentReward) {
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

        await showSuccessAlert(
          "댓글 등록 완료",
          "첫 피드백 보상으로 5,000 크레딧이 지급되었습니다."
        );
      } else {
        await showSuccessAlert(
          "댓글 등록 완료",
          "댓글이 정상적으로 등록되었습니다."
        );
      }

      setNewCommentContent("");
      loadComments(activePost.id);
      loadPosts();
    } catch (error) {
      console.error(error);
      await showErrorAlert(
        "댓글 등록 실패",
        "댓글 작성 중 오류가 발생했습니다."
      );
    }
  };

  const handleCreateReply = async (
    e: React.FormEvent,
    parentId: number
  ) => {
    e.preventDefault();

    if (!activePost || activePost.id === "new") return;
    if (!replyText.trim()) return;

    try {
      await createComment(activePost.id, {
        content: replyText,
        parentId,
      });

      setReplyText("");
      setReplyParentId(null);

      await loadComments(activePost.id);
      await loadPosts();

      await showSuccessAlert(
        "답글 등록 완료",
        "답글이 정상적으로 등록되었습니다."
      );
    } catch (error) {
      console.error(error);
      await showErrorAlert(
        "답글 등록 실패",
        "답글 작성 중 오류가 발생했습니다."
      );
    }
  };

  const handleDeleteComment = async (
    commentId: number,
    isReply = false
  ) => {
    if (!activePost || activePost.id === "new") return;

    const confirmed = await showConfirmAlert({
      title: isReply
        ? "답글을 삭제하시겠습니까?"
        : "댓글을 삭제하시겠습니까?",
      text: "삭제한 내용은 복구할 수 없습니다.",
      confirmText: "삭제",
      cancelText: "취소",
      danger: true,
    });

    if (!confirmed) return;

    try {
      await deleteComment(commentId);

      const updatedComments = await getComments(activePost.id);
      setComments(updatedComments || []);

      const updatedPost = await getPost(activePost.id);
      setActivePost(updatedPost);

      await loadPosts();

      await showSuccessAlert(
        isReply ? "답글 삭제 완료" : "댓글 삭제 완료",
        isReply
          ? "답글이 정상적으로 삭제되었습니다."
          : "댓글이 정상적으로 삭제되었습니다."
      );
    } catch (error) {
      console.error("댓글 삭제 실패:", error);

      await showErrorAlert(
        isReply ? "답글 삭제 실패" : "댓글 삭제 실패",
        error instanceof Error
          ? error.message
          : "삭제 중 오류가 발생했습니다."
      );
    }
  };

  const handleSharePost = async (postId: number) => {
    await showToast(
      `게시글 ${postId} 공유 기능은 준비 중입니다.`,
      "info"
    );
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
              setComments([]);
              setReplyParentId(null);
              setLiked(false);
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
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid var(--border)",
                paddingTop: "1rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "1.5rem",
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  className="post-action-btn"
                  onClick={() => handleLikePost(activePost.id)}
                  style={{
                    cursor: "pointer",
                    color: liked ? "var(--accent)" : "inherit",
                    fontWeight: liked ? 700 : 400,
                  }}
                >
                  <ThumbsUp
                    size={16}
                    fill={liked ? "currentColor" : "none"}
                  />

                  {liked ? "좋아요 취소" : "좋아요"} (
                  {getLikeCount(activePost)})
                </button>

                <button
                  type="button"
                  className="post-action-btn"
                  onClick={() =>
                    handleSubmitReport("POST", activePost.id)
                  }
                >
                  <AlertCircle size={16} />
                  게시글 신고
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  marginLeft: "auto",
                }}
              >
                <button
                  type="button"
                  onClick={handleEditPost}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--accent)",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                  }}
                >
                  게시글 수정
                </button>

                <button
                  type="button"
                  onClick={handleDeletePost}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#ef4444",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                  }}
                >
                  게시글 삭제
                </button>
              </div>
            </div>
          </div>

          <div className="comment-section">
            <h3>피드백 및 댓글</h3>

            <form
              onSubmit={handleCreateComment}
              style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}
            >
              <div className="form-group">
                <textarea
                  className="form-input"
                  placeholder="UX 피드백 댓글을 입력하세요..."
                  value={newCommentContent}
                  onChange={(e) => setNewCommentContent(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="submit" className="btn btn-primary">
                  피드백 등록
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

                    <div
                      className="comment-footer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        gap: "0.75rem",
                        marginTop: "0.5rem",
                      }}
                    >
                      <span>{comment.createdAt?.slice(0, 16)}</span>

                      <button
                        type="button"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--accent-hover)",
                          cursor: "pointer",
                          padding: 0,
                          fontSize: "0.8rem",
                        }}
                        onClick={() => {
                          setReplyParentId(comment.id);
                          setReplyText("");
                        }}
                      >
                        답글
                      </button>

                      {(comment.writerEmail === currentUser.email ||
                        comment.author === currentUser.email) && (
                          <button
                            type="button"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#ef4444",
                              cursor: "pointer",
                              padding: 0,
                              fontSize: "0.8rem",
                            }}
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            삭제
                          </button>
                        )}

                      <button
                        type="button"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          padding: 0,
                          fontSize: "0.8rem",
                        }}
                        onClick={() =>
                          handleSubmitReport("COMMENT", comment.id)
                        }
                      >
                        신고
                      </button>
                    </div>
                  </div>

                  {replyParentId === comment.id && (
                    <form
                      onSubmit={(e) => handleCreateReply(e, comment.id)}
                      style={{
                        marginLeft: "2rem",
                        marginTop: "0.75rem",
                        marginBottom: "1rem",
                        paddingLeft: "1rem",
                        borderLeft: "2px solid var(--accent)",
                      }}
                    >
                      <p
                        style={{
                          marginBottom: "0.5rem",
                          color: "var(--accent-hover)",
                          fontSize: "0.9rem",
                        }}
                      >
                      </p>

                      <textarea
                        className="form-input"
                        placeholder="답글을 입력하세요..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        required
                      />

                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          marginTop: "0.75rem",
                        }}
                      >
                        <button type="submit" className="btn btn-primary">
                          답글 등록
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setReplyParentId(null);
                            setReplyText("");
                          }}
                        >
                          취소
                        </button>
                      </div>
                    </form>
                  )}

                  {(comment.replies || []).map((reply) => (
                    <div
                      key={reply.id}
                      className="comment-card reply"
                      style={{
                        marginLeft: "2rem",
                        paddingLeft: "1rem",
                        borderLeft: "2px solid var(--border)",
                      }}
                    >
                      <span className="comment-author">
                        ㄴ {reply.writerEmail || reply.author || "unknown"}
                      </span>

                      <p
                        className="comment-content"
                        style={{
                          marginTop: "0.5rem",
                          marginBottom: "0.5rem",
                        }}
                      >
                        {reply.content}
                      </p>

                      <div
                        className="comment-footer"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          gap: "0.75rem",
                        }}
                      >
                        <span>
                          {reply.createdAt
                            ?.replace("T", " ")
                            .slice(0, 16)}
                        </span>

                        {(reply.writerEmail === currentUser.email ||
                          reply.author === currentUser.email) && (
                            <button
                              type="button"
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#ef4444",
                                cursor: "pointer",
                                padding: 0,
                                fontSize: "0.8rem",
                              }}
                              onClick={() =>
                                handleDeleteComment(reply.id, true)
                              }
                            >
                              삭제
                            </button>
                          )}

                        <button
                          type="button"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: 0,
                            fontSize: "0.8rem",
                          }}
                          onClick={() =>
                            handleSubmitReport("COMMENT", reply.id)
                          }
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

          <form
            onSubmit={handleSearch}
            style={{
              display: "flex",
              gap: "0.75rem",
              marginBottom: "1.5rem",
            }}
          >
            <input
              type="text"
              className="form-input"
              placeholder="제목 또는 작성자 이메일을 검색하세요..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ flex: 1 }}
            />

            <button
              type="submit"
              className="btn btn-primary"
            >
              검색
            </button>

            {keyword && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleResetSearch}
              >
                초기화
              </button>
            )}
          </form>

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
                    onClick={() => openPost(post.id)}
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
                    {keyword
                      ? `"${keyword}" 검색 결과가 없습니다.`
                      : "아직 등록된 홍보글이 없습니다."}
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