import { useState } from "react";
import { createPost } from "../api/communityApi";
import { useLocation, useNavigate } from "react-router-dom";

export default function PostWritePage() {
    const navigate = useNavigate();
    const location = useLocation();

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");

    // 게시판에서 들어왔는지 확인
    const isCommentWrite = location.pathname.startsWith("/comment");

    const handleSubmit = async () => {
        if (!localStorage.getItem("accessToken")) {
            alert("로그인 후 글을 작성할 수 있습니다.");
            navigate("/login");
            return;
        }

        if (!title.trim()) {
            alert("제목을 입력하세요.");
            return;
        }

        if (!content.trim()) {
            alert("내용을 입력하세요.");
            return;
        }

        try {
            await createPost({
                title,
                content,
            });

            alert("게시글이 작성되었습니다.");

            // 작성 완료 후 원래 페이지로 이동
            navigate(isCommentWrite ? "/comment" : "/community");
        } catch (error) {
            alert(
                error instanceof Error
                    ? error.message
                    : "게시글 작성 실패"
            );
        }
    };

    return (
        <div className="post-write-page">
            <h1>게시글 작성</h1>

            <input
                type="text"
                placeholder="제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
            />

            <textarea
                placeholder="내용"
                value={content}
                onChange={(e) => setContent(e.target.value)}
            />

            <div
                style={{
                    display: "flex",
                    gap: "10px",
                    marginTop: "20px",
                }}
            >
                <button onClick={handleSubmit}>
                    작성하기
                </button>

                <button
                    onClick={() =>
                        navigate(
                            isCommentWrite
                                ? "/comment"
                                : "/community"
                        )
                    }
                >
                    취소
                </button>
            </div>
        </div>
    );
}