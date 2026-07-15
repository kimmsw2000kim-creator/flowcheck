import React, { useCallback, useEffect, useState } from "react";
import { ThumbsUp } from "lucide-react";
import { useParams } from "react-router-dom";
import {
    createComment,
    getComments,
    getPosts,
    likePost,
} from "../api/communityApi";

type Post = {
    id: number;
    title: string;
    content: string;
    writerEmail: string;
    createdAt: string;
    likeCount: number;
    commentCount: number;
};

type Comment = {
    id: number;
    content: string;
    writerEmail: string;
    createdAt: string;
    parentId: number | null;
    replies: Comment[];
};

export default function PostDetailPage() {
    const { postId } = useParams();
    const numericPostId = Number(postId);

    const [post, setPost] = useState<Post | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentText, setCommentText] = useState("");
    const [replyText, setReplyText] = useState<Record<number, string>>({});
    const [openReplyBox, setOpenReplyBox] = useState<number | null>(null);

    const fetchPost = useCallback(async () => {
        try {
            const res = await getPosts(0, 1000);
            const foundPost = res.data.content.find(
                (item: Post) => item.id === numericPostId
            );

            setPost(foundPost || null);
        } catch (error) {
            console.error("게시글 상세 조회 실패:", error);
        }
    }, [numericPostId]);

    const fetchComments = useCallback(async () => {
        try {
            const res = await getComments(numericPostId);
            setComments(res.data);
        } catch (error) {
            console.error("댓글 조회 실패:", error);
        }
    }, [numericPostId]);

    useEffect(() => {
        if (!numericPostId) return;

        fetchPost();
        fetchComments();
    }, [fetchComments, fetchPost, numericPostId]);

    const handleLike = async () => {
        try {
            await likePost(numericPostId);
            fetchPost();
        } catch (error) {
            console.error("좋아요 실패:", error);
        }
    };

    const handleCommentSubmit = async () => {
        if (!commentText.trim()) return;

        try {
            await createComment(numericPostId, {
                content: commentText,
                parentId: null,
            });

            setCommentText("");
            fetchComments();
            fetchPost();
        } catch (error) {
            console.error("댓글 작성 실패:", error);
        }
    };

    const handleReplySubmit = async (parentId: number) => {
        const text = replyText[parentId];

        if (!text?.trim()) return;

        try {
            await createComment(numericPostId, {
                content: text,
                parentId,
            });

            setReplyText({
                ...replyText,
                [parentId]: "",
            });

            setOpenReplyBox(null);
            fetchComments();
            fetchPost();
        } catch (error) {
            console.error("대댓글 작성 실패:", error);
        }
    };

    if (!post) {
        return (
            <div className="min-h-screen bg-slate-50 px-8 py-10">
                <div className="mx-auto max-w-4xl rounded-xl border bg-white p-8 text-center">
                    게시글을 불러오는 중입니다.
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 px-8 py-10">
            <div className="mx-auto max-w-4xl">
                <button
                    onClick={() => (window.location.href = "/community")}
                    className="mb-4 rounded border bg-white px-4 py-2 text-sm"
                >
                    목록으로
                </button>

                <div className="rounded-xl border bg-white p-6">
                    <h1 className="text-2xl font-bold text-slate-900">{post.title}</h1>

                    <div className="mt-3 flex justify-between text-sm text-slate-500">
                        <span>작성자: {post.writerEmail}</span>
                        <span>{post.createdAt?.slice(0, 10)}</span>
                    </div>

                    <div className="mt-6 min-h-60 whitespace-pre-wrap border-y py-6 text-slate-800">
                        {post.content}
                    </div>

                    <div className="mt-6 flex justify-center">
                        <button
                            onClick={handleLike}
                            className="flex items-center gap-2 rounded-full border px-6 py-3 font-semibold hover:bg-blue-50"
                        >
                            <ThumbsUp size={18} />
                            좋아요 {post.likeCount}
                        </button>
                    </div>
                </div>

                <div className="mt-6 rounded-xl border bg-white p-6">
                    <h2 className="text-lg font-bold">댓글 {post.commentCount}</h2>

                    <div className="mt-4 flex gap-2">
                        <input
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="댓글을 입력하세요"
                            className="flex-1 rounded border px-4 py-3"
                        />

                        <button
                            onClick={handleCommentSubmit}
                            className="rounded bg-blue-600 px-5 py-3 font-semibold text-white"
                        >
                            등록
                        </button>
                    </div>

                    <div className="mt-6 space-y-4">
                        {comments.length === 0 && (
                            <div className="rounded border p-4 text-center text-slate-500">
                                아직 댓글이 없습니다.
                            </div>
                        )}

                        {comments.map((comment) => (
                            <div key={comment.id} className="rounded border p-4">
                                <div className="text-sm font-semibold text-slate-700">
                                    {comment.writerEmail}
                                </div>

                                <p className="mt-2 text-slate-900">{comment.content}</p>

                                <button
                                    onClick={() =>
                                        setOpenReplyBox(
                                            openReplyBox === comment.id ? null : comment.id
                                        )
                                    }
                                    className="mt-3 text-sm text-blue-600"
                                >
                                    답글 달기
                                </button>

                                {openReplyBox === comment.id && (
                                    <div className="mt-3 flex gap-2">
                                        <input
                                            value={replyText[comment.id] || ""}
                                            onChange={(e) =>
                                                setReplyText({
                                                    ...replyText,
                                                    [comment.id]: e.target.value,
                                                })
                                            }
                                            placeholder="대댓글을 입력하세요"
                                            className="flex-1 rounded border px-3 py-2"
                                        />

                                        <button
                                            onClick={() => handleReplySubmit(comment.id)}
                                            className="rounded bg-slate-800 px-4 py-2 text-white"
                                        >
                                            등록
                                        </button>
                                    </div>
                                )}

                                {comment.replies?.length > 0 && (
                                    <div className="mt-4 space-y-3 border-l-4 border-slate-300 pl-4">
                                        {comment.replies.map((reply) => (
                                            <div key={reply.id} className="rounded bg-slate-50 p-3">
                                                <div className="text-sm font-semibold text-slate-700">
                                                    ㄴ {reply.writerEmail}
                                                </div>
                                                <p className="mt-1 text-slate-800">{reply.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
