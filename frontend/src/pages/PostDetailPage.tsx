import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
    getPost,
    deletePost,
    createComment,
    deleteComment,
} from "../api/communityApi";

interface Comment {
    id: number;
    content: string;
    nickname?: string;
    email?: string;
    createdAt?: string;
}

interface Post {
    id: number;
    title: string;
    content: string;
    nickname?: string;
    email?: string;
    createdAt?: string;
    comments?: Comment[];
}

export default function PostDetailPage() {
    const { postId } = useParams();
    const [post, setPost] = useState<Post | null>(null);
    const [commentContent, setCommentContent] = useState("");

    const loadPost = async () => {
        if (!postId) return;

        try {
            const data = await getPost(postId);
            setPost(data);
        } catch (error) {
            alert(error instanceof Error ? error.message : "오류가 발생했습니다.");
        }
    };

    useEffect(() => {
        loadPost();
    }, [postId]);

    const handleDeletePost = async () => {
        if (!postId) return;

        if (!confirm("게시글을 삭제하시겠습니까?")) return;

        try {
            await deletePost(postId);
            alert("삭제되었습니다.");
            window.location.href = "/community";
        } catch (error) {
            alert(error instanceof Error ? error.message : "삭제 실패");
        }
    };

    const handleCreateComment = async () => {
        if (!postId) return;

        if (!localStorage.getItem("accessToken")) {
            alert("로그인 후 댓글을 작성할 수 있습니다.");
            window.location.href = "/login";
            return;
        }

        if (!commentContent.trim()) {
            alert("댓글 내용을 입력하세요.");
            return;
        }

        try {
            await createComment(postId, commentContent);
            setCommentContent("");
            loadPost();
        } catch (error) {
            alert(error instanceof Error ? error.message : "댓글 작성 실패");
        }
    };

    const handleDeleteComment = async (commentId: number) => {
        if (!confirm("댓글을 삭제하시겠습니까?")) return;

        try {
            await deleteComment(commentId);
            loadPost();
        } catch (error) {
            alert(error instanceof Error ? error.message : "댓글 삭제 실패");
        }
    };

    if (!post) return <p>게시글 불러오는 중...</p>;

    return (
        <div className="post-detail-page">
            <button onClick={() => (window.location.href = "/community")}>
                목록으로
            </button>

            <h1>{post.title}</h1>
            <p>작성자: {post.nickname || post.email || "익명"}</p>

            <div className="post-content">
                {post.content}
            </div>

            <div className="post-actions">
                <button
                    onClick={() =>
                        (window.location.href = `/community/${post.id}/edit`)
                    }
                >
                    수정
                </button>
                <button onClick={handleDeletePost}>삭제</button>
            </div>

            <hr />

            <h3>댓글</h3>

            <div className="comment-form">
                <textarea
                    value={commentContent}
                    placeholder="댓글을 입력하세요"
                    onChange={(e) => setCommentContent(e.target.value)}
                />
                <button onClick={handleCreateComment}>댓글 작성</button>
            </div>

            <div className="comment-list">
                {post.comments?.length ? (
                    post.comments.map((comment) => (
                        <div key={comment.id} className="comment-item">
                            <p>{comment.content}</p>
                            <small>
                                작성자: {comment.nickname || comment.email || "익명"}
                            </small>
                            <br />
                            <button onClick={() => handleDeleteComment(comment.id)}>
                                댓글 삭제
                            </button>
                        </div>
                    ))
                ) : (
                    <p>댓글이 없습니다.</p>
                )}
            </div>
        </div>
    );
}