import React, { useEffect, useState } from "react";
import { MessageCircle, ThumbsUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
    showConfirmAlert,
    showErrorAlert,
    showSuccessAlert,
    showWarningAlert,
} from "../utils/alert";
import {
    createComment,
    deleteComment,
    deletePost,
    getComments,
    getLikeStatus,
    getPost,
    getPosts,
    likePost,
} from "../api/communityApi";

interface CommentPageProps {
    currentUser: {
        id: string;
        email: string;
        balance: number;
        coupons: number;
    };
    showAlert: (message: string, type?: string) => void;
}

interface Post {
    id: number;
    title: string;
    content: string;
    writerEmail?: string;
    email?: string;
    createdAt: string;
    likeCount?: number;
    likes?: number;
    commentCount?: number;
}

interface Comment {
    id: number;
    content: string;
    writerEmail?: string;
    author?: string;
    createdAt: string;
    parentId: number | null;
    replies?: Comment[];
}

export default function CommentPage({
    currentUser,
    showAlert,
}: CommentPageProps) {
    const navigate = useNavigate();
    const [posts, setPosts] = useState<Post[]>([]);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);

    const [commentText, setCommentText] = useState("");
    const [replyText, setReplyText] = useState("");
    const [replyParentId, setReplyParentId] = useState<number | null>(null);
    const [liked, setLiked] = useState(false);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [searchInput, setSearchInput] = useState("");
    const [keyword, setKeyword] = useState("");
    const pageSize = 10;

    useEffect(() => {
        loadPosts();
    }, [page, keyword]);

    const loadPosts = async () => {
        try {
            const data = await getPosts(page - 1, pageSize, keyword);

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

    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        setPage(1);
        setKeyword(searchInput.trim());
    };

    const handleResetSearch = () => {
        setSearchInput("");
        setKeyword("");
        setPage(1);
    };

    const openPost = async (postId: number) => {
        try {
            const [postData, commentData, likeStatus] = await Promise.all([
                getPost(postId),
                getComments(postId),
                getLikeStatus(postId),
            ]);

            setSelectedPost(postData);
            setComments(commentData || []);
            setLiked(likeStatus.liked);
        } catch (error) {
            console.error(error);
            showAlert("게시글 상세 정보를 불러오지 못했습니다.", "error");
        }
    };

    const handleLike = async () => {
        if (!selectedPost) return;

        try {
            const result = await likePost(selectedPost.id);

            setLiked(result.liked);

            setSelectedPost((prev) =>
                prev
                    ? {
                        ...prev,
                        likeCount: result.likeCount,
                        likes: result.likeCount,
                    }
                    : prev
            );

            await loadPosts();

            showAlert(
                result.message,
                result.liked ? "success" : "info"
            );
        } catch (error) {
            console.error(error);

            const message =
                error instanceof Error
                    ? error.message
                    : "좋아요 처리에 실패했습니다.";

            showAlert(message, "error");
        }
    };

    const handleCreateComment = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedPost) return;
        if (!commentText.trim()) return;

        try {
            await createComment(selectedPost.id, {
                content: commentText,
                parentId: null,
            });

            setCommentText("");
            const commentData = await getComments(selectedPost.id);
            setComments(commentData || []);

            const updatedPost = await getPost(selectedPost.id);
            setSelectedPost(updatedPost);

            await showSuccessAlert(
                "댓글 등록 완료",
                "댓글이 정상적으로 등록되었습니다."
            );
        } catch (error) {
            console.error(error);
            await showErrorAlert(
                "댓글 등록 실패",
                "댓글 작성 중 오류가 발생했습니다."
            );
        }
    };

    const handleCreateReply = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedPost) return;
        if (!replyParentId) return;
        if (!replyText.trim()) return;

        try {
            await createComment(selectedPost.id, {
                content: replyText,
                parentId: replyParentId,
            });

            setReplyText("");
            setReplyParentId(null);

            const commentData = await getComments(selectedPost.id);
            setComments(commentData || []);

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

    const handleEditPost = async () => {
        if (!selectedPost) return;

        const loginEmail = (currentUser.email || "")
            .trim()
            .toLowerCase();

        const writerEmail = (
            selectedPost.writerEmail ||
            selectedPost.email ||
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

        navigate(`/comment/${selectedPost.id}/edit`);
    };

    const handleDeletePost = async () => {
        if (!selectedPost) return;

        const loginEmail = (currentUser.email || "")
            .trim()
            .toLowerCase();

        const writerEmail = (
            selectedPost.writerEmail ||
            selectedPost.email ||
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
            await deletePost(selectedPost.id);

            setSelectedPost(null);
            setComments([]);
            setReplyParentId(null);
            setReplyText("");
            setLiked(false);

            await loadPosts();

            await showSuccessAlert(
                "삭제 완료",
                "게시글이 삭제되었습니다."
            );
        } catch (error) {
            console.error("게시글 삭제 실패:", error);

            await showErrorAlert(
                "삭제 실패",
                error instanceof Error
                    ? error.message
                    : "게시글 삭제에 실패했습니다."
            );
        }
    };

    const handleDeleteComment = async (
        commentId: number,
        isReply = false
    ) => {
        if (!selectedPost) return;

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

            const updatedComments = await getComments(selectedPost.id);
            setComments(updatedComments || []);

            const updatedPost = await getPost(selectedPost.id);
            setSelectedPost(updatedPost);

            await loadPosts();

            await showSuccessAlert(
                isReply ? "답글 삭제 완료" : "댓글 삭제 완료",
                isReply
                    ? "답글이 삭제되었습니다."
                    : "댓글이 삭제되었습니다."
            );
        } catch (error) {
            console.error("댓글 삭제 오류:", error);

            await showErrorAlert(
                isReply ? "답글 삭제 실패" : "댓글 삭제 실패",
                error instanceof Error
                    ? error.message
                    : "삭제 중 오류가 발생했습니다."
            );
        }
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

    if (selectedPost) {
        return (
            <div style={{ textAlign: "left" }}>
                <button
                    className="btn btn-secondary"
                    style={{ marginBottom: "1.5rem" }}
                    onClick={() => {
                        setSelectedPost(null);
                        setComments([]);
                        setReplyParentId(null);
                        setReplyText("");
                        setLiked(false);
                    }}
                >
                    ← 게시판 목록으로 돌아가기
                </button>

                <div className="card">
                    <div className="post-header">
                        <span>작성자: {getWriter(selectedPost)}</span>
                        <span>{selectedPost.createdAt?.slice(0, 10)}</span>
                    </div>

                    <h2 style={{ marginBottom: "1rem", fontSize: "1.5rem" }}>
                        {selectedPost.title}
                    </h2>

                    <p
                        style={{
                            fontSize: "1.05rem",
                            lineHeight: 1.6,
                            marginBottom: "1.5rem",
                            whiteSpace: "pre-wrap",
                        }}
                    >
                        {selectedPost.content}
                    </p>

                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderTop: "1px solid var(--border)",
                            paddingTop: "1rem",
                        }}
                    >
                        <button
                            type="button"
                            className="post-action-btn"
                            onClick={handleLike}
                            style={{
                                cursor: "pointer",
                                fontWeight: liked ? 700 : 400,
                                color: liked ? "var(--accent)" : "inherit",
                            }}
                        >
                            <ThumbsUp
                                size={16}
                                fill={liked ? "currentColor" : "none"}
                            />

                            {liked ? "좋아요 취소" : "좋아요"} ({getLikeCount(selectedPost)})
                        </button>

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
                    <h3>댓글</h3>

                    <form
                        onSubmit={handleCreateComment}
                        style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}
                    >
                        <textarea
                            className="form-input"
                            placeholder="댓글을 입력하세요..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            required
                        />

                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ marginTop: "0.75rem" }}
                        >
                            댓글 등록
                        </button>
                    </form>


                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {comments.length === 0 && (
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

                        {comments.map((comment) => (
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
                                    </div>
                                </div>

                                {replyParentId === comment.id && (
                                    <form
                                        onSubmit={handleCreateReply}
                                        style={{
                                            marginLeft: "2rem",
                                            marginTop: "1rem",
                                            marginBottom: "1rem",
                                        }}
                                    >
                                        <textarea
                                            className="form-input"
                                            placeholder="답글을 입력하세요..."
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                        />

                                        <div
                                            style={{
                                                display: "flex",
                                                gap: "0.5rem",
                                                marginTop: "0.5rem",
                                            }}
                                        >
                                            <button
                                                className="btn btn-primary"
                                                type="submit"
                                            >
                                                답글 등록
                                            </button>

                                            <button
                                                className="btn btn-secondary"
                                                type="button"
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
                                                justifyContent: "flex-start",
                                                alignItems: "center",
                                                gap: "0.75rem",
                                            }}
                                        >
                                            <span>
                                                {reply.createdAt
                                                    ?.replace("T", " ")
                                                    .slice(0, 16)}
                                            </span>

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
                                                onClick={() => handleDeleteComment(reply.id, true)}
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ textAlign: "left" }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1.5rem",
                }}
            >
                <div>
                    <h2 style={{ fontSize: "1.75rem" }}>게시판</h2>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                        게시글을 선택하면 댓글과 대댓글을 작성할 수 있습니다.
                    </p>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={() => navigate("/comment/write")}
                >
                    게시글 작성
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
                    className="form-input"
                    type="text"
                    placeholder="제목 또는 작성자 이메일 검색"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    style={{ flex: 1 }}
                />

                <button
                    className="btn btn-primary"
                    type="submit"
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

            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ background: "var(--bg-tertiary)" }}>
                            <th style={{ padding: "0.75rem", width: "80px" }}>번호</th>
                            <th style={{ padding: "0.75rem", textAlign: "left" }}>제목</th>
                            <th style={{ padding: "0.75rem", width: "220px" }}>작성자</th>
                            <th style={{ padding: "0.75rem", width: "120px" }}>날짜</th>
                            <th style={{ padding: "0.75rem", width: "90px" }}>좋아요</th>
                            <th style={{ padding: "0.75rem", width: "90px" }}>댓글</th>
                        </tr>
                    </thead>

                    <tbody>
                        {posts.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    style={{
                                        textAlign: "center",
                                        padding: "2rem",
                                        color: "var(--text-muted)",
                                    }}
                                >
                                    {keyword
                                        ? `"${keyword}" 검색 결과가 없습니다.`
                                        : "게시글이 없습니다."}
                                </td>
                            </tr>
                        )}

                        {posts.map((post) => (
                            <tr
                                key={post.id}
                                style={{
                                    borderTop: "1px solid var(--border)",
                                    cursor: "pointer",
                                }}
                                onClick={() => openPost(post.id)}
                            >
                                <td style={{ padding: "0.75rem", textAlign: "center" }}>
                                    {post.id}
                                </td>

                                <td style={{ padding: "0.75rem", fontWeight: 600 }}>
                                    {post.title}
                                    {(post.commentCount || 0) > 0 && (
                                        <span style={{ marginLeft: "0.5rem", color: "#0070c9" }}>
                                            [{post.commentCount}]
                                        </span>
                                    )}
                                </td>

                                <td style={{ padding: "0.75rem", textAlign: "center" }}>
                                    {getWriter(post)}
                                </td>

                                <td style={{ padding: "0.75rem", textAlign: "center" }}>
                                    {post.createdAt?.slice(0, 10)}
                                </td>

                                <td style={{ padding: "0.75rem", textAlign: "center" }}>
                                    <ThumbsUp size={14} /> {getLikeCount(post)}
                                </td>

                                <td style={{ padding: "0.75rem", textAlign: "center" }}>
                                    <MessageCircle size={14} /> {post.commentCount || 0}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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
        </div>
    );
}