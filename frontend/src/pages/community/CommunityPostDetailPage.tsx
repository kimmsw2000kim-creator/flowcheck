import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { fetchCommunityPost } from '../../api/communityPostApi';
import EmptyState from '../../components/common/EmptyState';
import CommunityPostActions from '../../components/community/CommunityPostActions';
import CommunityTestResultSection from '../../components/community/CommunityTestResultSection';
import type { Post } from '../../types/post';

/*
 * 백엔드 날짜를 한국 날짜 형식으로 표시합니다.
 */
function formatDate(value: string): string {
    return new Date(value).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function CommunityPostDetailPage() {
    const { postId } = useParams();
    const navigate = useNavigate();

    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        /*
         * 페이지를 벗어난 뒤 API 응답이 도착해도
         * 상태가 변경되지 않도록 확인합니다.
         */
        let cancelled = false;

        const numericPostId = Number(postId);

        /*
         * 주소에 올바른 게시글 번호가 들어왔는지 검사합니다.
         */
        if (
            !Number.isInteger(numericPostId) ||
            numericPostId <= 0
        ) {
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

                const response = await fetchCommunityPost(
                    numericPostId
                );

                if (!cancelled) {
                    setPost(response);
                }
            } catch (error: unknown) {
                if (!cancelled) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : '게시글을 불러오지 못했습니다.';

                    setErrorMessage(message);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadPost();

        return () => {
            cancelled = true;
        };
    }, [postId]);

    if (loading) {
        return (
            <EmptyState
                title="게시글을 불러오는 중입니다."
                description="잠시만 기다려 주세요."
            />
        );
    }

    if (errorMessage || !post) {
        return (
            <div>
                <EmptyState
                    title={errorMessage || '게시글이 없습니다.'}
                    description="삭제됐거나 존재하지 않는 게시글입니다."
                />

                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate('/community')}
                >
                    커뮤니티로 돌아가기
                </button>
            </div>
        );
    }

    /*
     * 게시글 종류에 따라 돌아갈 탭을 결정합니다.
     */
    const listPath =
        post.category === 'SITE_PROMOTION'
            ? '/community?tab=promotion'
            : '/community?tab=tests';

    return (
        <div
            style={{
                maxWidth: '900px',
                margin: '0 auto',
                textAlign: 'left',
            }}
        >
            <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate(listPath)}
            >
                목록으로
            </button>

            <article
                className="card"
                style={{ marginTop: '1.5rem' }}
            >
                <header
                    style={{
                        borderBottom: '1px solid var(--border)',
                        paddingBottom: '1rem',
                        marginBottom: '1.5rem',
                    }}
                >
                    <h1>{post.title}</h1>

                    <small
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        {post.writerEmail} ·{' '}
                        {formatDate(post.createdAt)}
                    </small>
                </header>

                {/* 소개글을 작성한 경우에만 본문 영역을 표시합니다. */}
                {post.content.trim() && (
                    <p
                        style={{
                            minHeight: '160px',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.7,
                        }}
                    >
                        {post.content}
                    </p>
                )}
                {/*
 * 테스트 공유 게시글이고 실제 테스트 요청이 연결된 경우에만
 * 부하 테스트 또는 UI/UX 테스트 결과를 조회합니다.
 */}
                {post.category === 'TEST_SHARE' &&
                    post.testRequestId && (
                        <CommunityTestResultSection
                            postId={post.id}
                        />
                    )}

                <CommunityPostActions
                    post={post}
                    onUpdated={(updatedPost) => {
                        // 수정 API 응답을 상세 화면에 즉시 반영합니다.
                        setPost(updatedPost);
                    }}
                    onDeleted={() => {
                        // 삭제된 게시글 화면에 남지 않도록 목록으로 이동합니다.
                        navigate(listPath, { replace: true });
                    }}
                />
            </article>
        </div>
    );
}
