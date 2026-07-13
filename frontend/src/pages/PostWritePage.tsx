import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPost } from "../api/communityApi";
import {
    showErrorAlert,
    showSuccessAlert,
    showWarningAlert,
} from "../utils/alert";
import "../styles/PostWritePage.css";

export default function PostWritePage() {
    const navigate = useNavigate();
    const location = useLocation();

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const isCommentWrite = location.pathname.startsWith("/comment");
    const returnPath = isCommentWrite ? "/comment" : "/community";
    const pageName = isCommentWrite ? "게시판" : "커뮤니티";

    const handleSubmit = async (
        event: React.FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        if (submitting) return;

        const accessToken = localStorage.getItem("accessToken");
        const trimmedTitle = title.trim();
        const trimmedContent = content.trim();

        if (!accessToken) {
            await showWarningAlert(
                "로그인이 필요합니다.",
                "게시글 작성은 로그인 후 이용할 수 있습니다."
            );

            navigate("/login");
            return;
        }

        if (!trimmedTitle) {
            await showWarningAlert(
                "제목을 입력해주세요.",
                "게시글 제목은 비워둘 수 없습니다."
            );
            return;
        }

        if (!trimmedContent) {
            await showWarningAlert(
                "내용을 입력해주세요.",
                "게시글 내용을 작성해주세요."
            );
            return;
        }

        try {
            setSubmitting(true);

            await createPost({
                title: trimmedTitle,
                content: trimmedContent,
            });

            await showSuccessAlert(
                "작성 완료",
                "게시글이 정상적으로 등록되었습니다."
            );

            navigate(returnPath);
        } catch (error) {
            console.error("게시글 작성 실패:", error);

            await showErrorAlert(
                "작성 실패",
                error instanceof Error
                    ? error.message
                    : "게시글 작성 중 오류가 발생했습니다."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        if (submitting) return;
        navigate(returnPath);
    };

    return (
        <div className="post-write-page">
            <div className="post-write-container">
                <div className="post-write-header">
                    <span className="post-write-badge">
                        {pageName}
                    </span>

                    <h1>게시글 작성</h1>

                    <p>
                        다른 사용자들과 공유할 내용을 작성해 주세요.
                    </p>
                </div>

                <form
                    className="post-write-card"
                    onSubmit={handleSubmit}
                >
                    <div className="post-write-field">
                        <label htmlFor="post-title">
                            제목
                            <span aria-hidden="true">*</span>
                        </label>

                        <input
                            id="post-title"
                            type="text"
                            value={title}
                            maxLength={100}
                            placeholder="제목을 입력하세요."
                            onChange={(event) =>
                                setTitle(event.target.value)
                            }
                            disabled={submitting}
                            autoFocus
                        />

                        <div className="post-write-count">
                            {title.length} / 100
                        </div>
                    </div>

                    <div className="post-write-field">
                        <label htmlFor="post-content">
                            내용
                            <span aria-hidden="true">*</span>
                        </label>

                        <textarea
                            id="post-content"
                            value={content}
                            maxLength={5000}
                            placeholder="내용을 입력하세요."
                            onChange={(event) =>
                                setContent(event.target.value)
                            }
                            disabled={submitting}
                        />

                        <div className="post-write-count">
                            {content.length} / 5000
                        </div>
                    </div>

                    <div className="post-write-actions">
                        <button
                            type="button"
                            className="post-write-cancel"
                            onClick={handleCancel}
                            disabled={submitting}
                        >
                            취소
                        </button>

                        <button
                            type="submit"
                            className="post-write-submit"
                            disabled={submitting}
                        >
                            {submitting
                                ? "작성 중..."
                                : "작성하기"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}