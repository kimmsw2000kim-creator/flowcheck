import { useEffect, useState } from 'react';

import { fetchCommunityPosts } from '../../api/communityPostApi';
import type { Post } from '../../types/post';
import EmptyState from '../common/EmptyState';

interface SitePromotionPostListProps {
    /*
     * 게시글 작성 후 값이 변경되면 목록을 다시 불러옵니다.
     */
    refreshKey: number;
}

/*
 * 백엔드 날짜를 한국 시간 형식으로 표시합니다.
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

export default function SitePromotionPostList({
    refreshKey,
}: SitePromotionPostListProps) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        /*
         * 컴포넌트가 사라진 뒤 응답이 도착했을 때
         * 상태가 변경되는 것을 방지합니다.
         */
        let cancelled = false;

        const loadPosts = async () => {
            try {
                setLoading(true);
                setErrorMessage('');

                const page = await fetchCommunityPosts({
                    category: 'SITE_PROMOTION',
                    page: 0,
                    size: 10,
                    sort: 'createdAt,desc',
                });

                if (!cancelled) {
                    setPosts(page.content);
                }
            } catch (error: unknown) {
                if (!cancelled) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : '사이트 홍보 게시글을 불러오지 못했습니다.';

                    setErrorMessage(message);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadPosts();

        return () => {
            cancelled = true;
        };
    }, [refreshKey]);

    if (loading) {
        return (
            <EmptyState
                title="사이트 홍보 게시글을 불러오는 중입니다."
                description="잠시만 기다려 주세요."
            />
        );
    }

    if (errorMessage) {
        return (
            <EmptyState
                title={errorMessage}
                description="잠시 후 다시 시도해 주세요."
            />
        );
    }

    if (posts.length === 0) {
        return (
            <EmptyState
                title="등록된 사이트 홍보 게시글이 없습니다."
                description="첫 번째 사이트 홍보 게시글을 작성해 보세요."
            />
        );
    }

    return (
        <section style={{ marginTop: '2.5rem' }}>
            <h2>사이트 홍보 게시글</h2>

            <div
                style={{
                    display: 'grid',
                    gap: '1rem',
                    marginTop: '1rem',
                }}
            >
                {posts.map((post) => (
                    <article
                        key={post.id}
                        style={{
                            padding: '1.25rem',
                            border: '1px solid var(--border)',
                            borderRadius: '0.75rem',
                            backgroundColor: 'var(--bg-tertiary)',
                        }}
                    >
                        <h3 style={{ marginTop: 0 }}>
                            {post.title}
                        </h3>

                        <p
                            style={{
                                color: 'var(--text-secondary)',
                                whiteSpace: 'pre-wrap',
                            }}
                        >
                            {post.content}
                        </p>

                        <div
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '1rem',
                            }}
                        >
                            <small
                                style={{
                                    color: 'var(--text-secondary)',
                                }}
                            >
                                {post.writerEmail} ·{' '}
                                {formatDate(post.createdAt)}
                            </small>

                            {/* 홍보 URL이 있는 게시글에만 이동 버튼을 표시합니다. */}
                            {post.promoUrl && (
                                <a
                                    className="btn btn-secondary"
                                    href={post.promoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    사이트 방문
                                </a>
                            )}
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}