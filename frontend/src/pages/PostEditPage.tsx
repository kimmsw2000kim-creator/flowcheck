import { useEffect, useState } from "react";
import {
    useLocation,
    useNavigate,
    useParams,
} from "react-router-dom";
import { getPost, updatePost } from "../api/communityApi";

export default function PostEditPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { postId } = useParams<{ postId: string }>();

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const isCommentEdit =
        location.pathname.startsWith("/comment/");

    const returnPath = isCommentEdit
        ? "/comment"
        : "/community";

    useEffect(() => {
        const loadPost = async () => {
            if (!postId) {
                navigate(returnPath);
                return;
            }

            try {
                const post = await getPost(Number(postId));

                setTitle(post.title ?? "");
                setContent(post.content ?? "");
            } catch (error) {
                console.error("게시글 조회 실패:", error);
                alert("게시글을 불러오지 못했습니다.");
                navigate(returnPath);
            } finally {
                setLoading(false);
            }
        };

        loadPost();
    }, [postId]);

    const handleSubmit = async (
        e: React.FormEvent<HTMLFormElement>
    ) => {
        e.preventDefault();

        if (!postId || submitting) return;

        if (!title.trim()) {
            alert("제목을 입력해주세요.");
            return;
        }

        if (!content.trim()) {
            alert("내용을 입력해주세요.");
            return;
        }

        try {
            setSubmitting(true);

            await updatePost(Number(postId), {
                title: title.trim(),
                content: content.trim(),
            });

            alert("게시글이 수정되었습니다.");

            navigate(returnPath);
        } catch (error) {
            console.error("게시글 수정 실패:", error);

            alert(
                error instanceof Error
                    ? error.message
                    : "게시글 수정에 실패했습니다."
            );
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div
                style={{
                    padding: "3rem",
                    textAlign: "center",
                }}
            >
                게시글을 불러오는 중입니다...
            </div>
        );
    }

    return (
        <div
            style={{
                maxWidth: "900px",
                margin: "0 auto",
                textAlign: "left",
            }}
        >
            <h1 style={{ marginBottom: "2rem" }}>
                게시글 수정
            </h1>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label">
                        제목
                    </label>

                    <input
                        type="text"
                        className="form-input"
                        value={title}
                        onChange={(e) =>
                            setTitle(e.target.value)
                        }
                        required
                    />
                </div>

                <div
                    className="form-group"
                    style={{ marginTop: "1rem" }}
                >
                    <label className="form-label">
                        내용
                    </label>

                    <textarea
                        className="form-input"
                        rows={10}
                        value={content}
                        onChange={(e) =>
                            setContent(e.target.value)
                        }
                        required
                    />
                </div>

                <div
                    style={{
                        display: "flex",
                        gap: "0.75rem",
                        marginTop: "1.5rem",
                    }}
                >
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={submitting}
                    >
                        {submitting
                            ? "수정 중..."
                            : "수정 완료"}
                    </button>

                    <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={submitting}
                        onClick={() => navigate(returnPath)}
                    >
                        취소
                    </button>
                </div>
            </form>
        </div>
    );
}