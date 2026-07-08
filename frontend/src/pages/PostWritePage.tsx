import { useState } from "react";
import { createPost } from "../api/communityApi";

export default function PostWritePage() {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");

    const handleSubmit = async () => {
        if (!localStorage.getItem("accessToken")) {
            alert("로그인 후 글을 작성할 수 있습니다.");
            window.location.href = "/login";
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
            await createPost({ title, content });
            alert("게시글이 작성되었습니다.");
            window.location.href = "/community";
        } catch (error) {
            alert(error instanceof Error ? error.message : "게시글 작성 실패");
        }
    };

    return (
        <div className="post-write-page">
            <h1>게시글 작성</h1>

            <input
                type="text"
                value={title}
                placeholder="제목"
                onChange={(e) => setTitle(e.target.value)}
            />

            <textarea
                value={content}
                placeholder="내용"
                onChange={(e) => setContent(e.target.value)}
            />

            <button onClick={handleSubmit}>작성하기</button>
            <button onClick={() => (window.location.href = "/community")}>
                취소
            </button>
        </div>
    );
}