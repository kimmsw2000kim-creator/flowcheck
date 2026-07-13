import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPost, updatePost } from "../api/communityApi";

export default function PostEditPage() {
    const { postId } = useParams();

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");

    useEffect(() => {
        const loadPost = async () => {
            if (!postId) return;

            try {
                const data = await getPost(Number(postId));
                setTitle(data.title);
                setContent(data.content);
            } catch (error) {
                alert(error instanceof Error ? error.message : "게시글 조회 실패");
            }
        };

        loadPost();
    }, [postId]);

    const handleSubmit = async () => {
        if (!postId) return;

        if (!title.trim()) {
            alert("제목을 입력하세요.");
            return;
        }

        if (!content.trim()) {
            alert("내용을 입력하세요.");
            return;
        }

        try {
            await updatePost(Number(postId), { title, content });
            alert("게시글이 수정되었습니다.");
            window.location.href = `/community/${postId}`;
        } catch (error) {
            alert(error instanceof Error ? error.message : "게시글 수정 실패");
        }
    };

    return (
        <div className="post-edit-page">
            <h1>게시글 수정</h1>

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

            <button onClick={handleSubmit}>수정하기</button>
            <button onClick={() => (window.location.href = `/community/${postId}`)}>
                취소
            </button>
        </div>
    );
}