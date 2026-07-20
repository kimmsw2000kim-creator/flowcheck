import { useEffect, useState, type FormEvent } from 'react';
import { ThumbsUp } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import {
    createCommunityPostComment,
    deleteCommunityPostComment,
    fetchCommunityPost,
    fetchCommunityPostComments,
    fetchCommunityPostLikeStatus,
    toggleCommunityPostLike,
} from '../../api/communityPostApi';
import { Button, Card, EmptyState } from '../../components/common';
import CommunityPostActions from '../../components/community/CommunityPostActions';
import { CommunityAuthor } from '../../components/community/CommunityPostList';
import CommunityTestResultSection from '../../components/community/CommunityTestResultSection';
import { CommentPagination, ForumCommentThread } from '../../components/community';
import { COMMENTS_PER_PAGE } from '../../components/community/CommentPagination';
import { COMMUNITY_LIMITS } from '../../constants/communityLimits';
import { useAlertStore } from '../../store/alertStore';
import { useUserStore } from '../../store/userStore';
import type { Post, PostComment, PostCommentPage } from '../../types/post';

function formatDate(value: string): string {
    return new Date(value).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export default function CommunityPostDetailPage() {
    const { postId } = useParams();
    const navigate = useNavigate();
    const showAlert = useAlertStore((state) => state.showAlert);
    const currentUserEmail = useUserStore((state) => state.currentUser.email);
    const numericPostId = Number(postId);

    const [post, setPost] = useState<Post | null>(null);
    const [liked, setLiked] = useState(false);
    const [comments, setComments] = useState<PostComment[]>([]);
    const [commentPage, setCommentPage] = useState(1);
    const [totalCommentPages, setTotalCommentPages] = useState(1);
    const [commentValue, setCommentValue] = useState('');
    const [replyValue, setReplyValue] = useState('');
    const [replyParentId, setReplyParentId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const applyCommentPage = (response: PostCommentPage) => {
        setComments(response.content ?? []);
        setCommentPage((response.number ?? 0) + 1);
        setTotalCommentPages(Math.max(response.totalPages ?? 1, 1));
    };

    useEffect(() => {
        let cancelled = false;

        if (!Number.isInteger(numericPostId) || numericPostId <= 0) {
            setErrorMessage('올바르지 않은 게시글 번호입니다.');
            setLoading(false);
            return () => {
                cancelled = true;
            };
        }

        const loadPost = async () => {
            try {
                setLoading(true);
                setErrorMessage('');

                const [postResponse, likeResponse, commentResponse] = await Promise.all([
                    fetchCommunityPost(numericPostId),
                    fetchCommunityPostLikeStatus(numericPostId),
                    fetchCommunityPostComments(numericPostId, 0, COMMENTS_PER_PAGE),
                ]);

                if (!cancelled) {
                    setPost(postResponse);
                    setLiked(likeResponse.liked);
                    applyCommentPage(commentResponse);
                }
            } catch (error: unknown) {
                if (!cancelled) {
                    setErrorMessage(getErrorMessage(error, '게시글을 불러오지 못했습니다.'));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void loadPost();
        return () => {
            cancelled = true;
        };
    }, [numericPostId]);

    const refreshPost = async () => {
        const response = await fetchCommunityPost(numericPostId);
        setPost(response);
    };

    const loadCommentPage = async (page: number) => {
        const response = await fetchCommunityPostComments(
            numericPostId,
            Math.max(page - 1, 0),
            COMMENTS_PER_PAGE,
        );
        applyCommentPage(response);
    };

    const toggleLike = async () => {
        try {
            setSubmitting(true);
            const response = await toggleCommunityPostLike(numericPostId);
            setLiked(response.liked);
            setPost((current) => current ? { ...current, likeCount: response.likeCount } : current);
            showAlert(response.message, 'success');
        } catch (error: unknown) {
            showAlert(getErrorMessage(error, '좋아요 처리에 실패했습니다.'), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const validateContent = (value: string): boolean => {
        const content = value.trim();
        if (!content) {
            showAlert('댓글 내용을 입력해주세요.', 'error');
            return false;
        }
        if (content.length > COMMUNITY_LIMITS.COMMENT) {
            showAlert(`댓글은 최대 ${COMMUNITY_LIMITS.COMMENT}자까지 입력할 수 있습니다.`, 'error');
            return false;
        }
        return true;
    };

    const submitComment = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!validateContent(commentValue)) return;

        try {
            setSubmitting(true);
            await createCommunityPostComment(numericPostId, { content: commentValue.trim() });
            setCommentValue('');

            // 새 부모 댓글이 표시되는 마지막 페이지로 이동합니다.
            const firstPage = await fetchCommunityPostComments(numericPostId, 0, COMMENTS_PER_PAGE);
            const lastPage = Math.max(firstPage.totalPages, 1);
            if (lastPage === 1) {
                applyCommentPage(firstPage);
            } else {
                await loadCommentPage(lastPage);
            }
            await refreshPost();
            showAlert('댓글을 등록했습니다.', 'success');
        } catch (error: unknown) {
            showAlert(getErrorMessage(error, '댓글 작성에 실패했습니다.'), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const submitReply = async (event: FormEvent<HTMLFormElement>, parentId: number) => {
        event.preventDefault();
        if (!validateContent(replyValue)) return;

        try {
            setSubmitting(true);
            await createCommunityPostComment(numericPostId, {
                content: replyValue.trim(),
                parentId,
            });
            setReplyValue('');
            setReplyParentId(null);
            await Promise.all([loadCommentPage(commentPage), refreshPost()]);
            showAlert('답글을 등록했습니다.', 'success');
        } catch (error: unknown) {
            showAlert(getErrorMessage(error, '답글 작성에 실패했습니다.'), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const removeComment = async (commentId: number, isReply = false) => {
        if (!window.confirm(`${isReply ? '답글' : '댓글'}을 삭제하시겠습니까?`)) return;

        try {
            setSubmitting(true);
            await deleteCommunityPostComment(commentId);
            const response = await fetchCommunityPostComments(
                numericPostId,
                Math.max(commentPage - 1, 0),
                COMMENTS_PER_PAGE,
            );
            if (response.content.length === 0 && commentPage > 1) {
                await loadCommentPage(commentPage - 1);
            } else {
                applyCommentPage(response);
            }
            await refreshPost();
            showAlert(`${isReply ? '답글' : '댓글'}을 삭제했습니다.`, 'success');
        } catch (error: unknown) {
            showAlert(getErrorMessage(error, '댓글 삭제에 실패했습니다.'), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <EmptyState title="게시글을 불러오는 중입니다." description="잠시만 기다려주세요." />;
    }

    if (errorMessage || !post) {
        return (
            <div>
                <EmptyState
                    title={errorMessage || '게시글이 없습니다.'}
                    description="삭제됐거나 존재하지 않는 게시글입니다."
                />
                <Button type="button" variant="secondary" onClick={() => navigate('/community')}>
                    커뮤니티로 돌아가기
                </Button>
            </div>
        );
    }

    const listPath = post.category === 'SITE_PROMOTION'
        ? '/community?tab=promotion'
        : '/community?tab=tests';

    return (
        <div className="community-page community-page--narrow community-post-detail-page">
            <Button type="button" variant="secondary" onClick={() => navigate(listPath)}>
                목록으로
            </Button>

            <Card as="article" padding="lg" className="community-post-detail">
                <header className="community-post-detail__header">
                    <h1>{post.title}</h1>
                    <div className="community-post-detail__meta">
                        <CommunityAuthor email={post.writerEmail} avatarUrl={post.writerAvatarUrl} />
                        <div className="community-post-detail__controls">
                            <CommunityPostActions
                                post={post}
                                onUpdated={setPost}
                                onDeleted={() => navigate(listPath, { replace: true })}
                            />
                            <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
                        </div>
                    </div>
                </header>

                {post.content.trim() && (
                    <p className="community-post-detail__content">
                        {post.content}
                    </p>
                )}
                {post.category === 'TEST_SHARE' && post.testRequestId && (
                    <CommunityTestResultSection postId={post.id} />
                )}

                <div className="community-actions community-post-detail__engagement">
                    <Button
                        type="button"
                        variant={liked ? 'primary' : 'secondary'}
                        size="sm"
                        icon={ThumbsUp}
                        aria-pressed={liked}
                        disabled={submitting}
                        onClick={() => void toggleLike()}
                    >
                        좋아요 {post.likeCount}
                    </Button>
                </div>

            </Card>

            <ForumCommentThread
                comments={comments}
                commentCount={post.commentCount}
                currentUserEmail={currentUserEmail}
                value={commentValue}
                replyValue={replyValue}
                replyParentId={replyParentId}
                label="댓글"
                onValueChange={setCommentValue}
                onReplyValueChange={setReplyValue}
                onSubmit={submitComment}
                onSubmitReply={submitReply}
                onToggleReply={(commentId) => {
                    setReplyParentId(commentId);
                    setReplyValue('');
                }}
                onDelete={(commentId, isReply) => void removeComment(commentId, isReply)}
            />
            <CommentPagination
                currentPage={commentPage}
                totalPages={totalCommentPages}
                onPageChange={(page) => void loadCommentPage(page)}
            />
        </div>
    );
}
