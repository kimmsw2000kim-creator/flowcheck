import React, { useEffect, useState } from "react";
import { MessageCircle, ThumbsUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
    createComment,
    getComments,
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

export default function CommentPage({ showAlert }: CommentPageProps) {
    const navigate = useNavigate();
    const [posts, setPosts] = useState<Post[]>([]);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);

    const [commentText, setCommentText] = useState("");
    const [replyText, setReplyText] = useState("");
    const [replyParentId, setReplyParentId] = useState<number | null>(null);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const pageSize = 10;

    useEffect(() => {
        loadPosts();
    }, [page]);

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

    const openPost = async (postId: number) => {
        try {
            const postData = await getPost(postId);
            const commentData = await getComments(postId);

            setSelectedPost(postData);
            setComments(commentData || []);
        } catch (error) {
            console.error(error);
            showAlert("게시글 상세 정보를 불러오지 못했습니다.", "error");
        }
    };

    const handleLike = async () => {
        if (!selectedPost) return;

        try {
            await likePost(selectedPost.id);
            const updatedPost = await getPost(selectedPost.id);
            setSelectedPost(updatedPost);
            loadPosts();
            showAlert("좋아요를 눌렀습니다.", "success");
        } catch (error) {
            console.error(error);
            showAlert("좋아요 처리에 실패했습니다.", "error");
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

            showAlert("댓글이 등록되었습니다.", "success");
        } catch (error) {
            console.error(error);
            showAlert("댓글 작성에 실패했습니다.", "error");
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

            showAlert("답글이 등록되었습니다.", "success");
        } catch (error) {
            console.error(error);
            showAlert("답글 작성에 실패했습니다.", "error");
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
                            borderTop: "1px solid var(--border)",
                            paddingTop: "1rem",
                        }}
                    >
                        <button className="post-action-btn" onClick={handleLike}>
                            <ThumbsUp size={16} /> 좋아요 ({getLikeCount(selectedPost)})
                        </button>
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

                    {replyParentId && (
                        <form
                            onSubmit={handleCreateReply}
                            style={{ marginBottom: "1.5rem" }}
                        >
                            <p style={{ marginBottom: "0.5rem", color: "var(--accent)" }}>
                                댓글 #{replyParentId}에 답글 작성 중
                            </p>

                            <textarea
                                className="form-input"
                                placeholder="답글을 입력하세요..."
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                required
                            />

                            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
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
                    onClick={() => navigate("/community/write")}
                >
                    게시글 작성
                </button>
            </div>



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
                                    게시글이 없습니다.
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