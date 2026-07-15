import { useEffect, useState } from 'react';

import { fetchCommunityPosts } from '../../api/communityPostApi';
import type { Post } from '../../types/post';
import EmptyState from '../common/EmptyState';

interface TestSharePostListProps {
    /*
     * 테스트 공유 성공 후 값이 변경되면 목록을 다시 조회합니다.
     */
    refreshKey: number;
}

function formatDate(value: string): string {
    return new Date(value).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function TestSharePostList({
    refreshKey,
}: TestSharePostListProps) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        /*
         * 컴포넌트가 사라진 뒤 API 응답이 도착했을 때
         * 상태를 변경하지 않도록 처리합니다.
         */
        let cancelled = false;

        const loadPosts = async () => {
            try {
                setLoading(true);
                setErrorMessage('');

                const page = await fetchCommunityPosts({
                    category: 'TEST_SHARE',
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
                            : '테스트 공유 게시글을 불러오지 못했습니다.';

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
                title="테스트 공유 게시글을 불러오는 중입니다."
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
                title="공유된 테스트 결과가 없습니다."
                description="완료된 테스트 결과를 처음으로 공유해 보세요."
            />
        );
    }

    return (
        <section style={{ marginTop: '2.5rem' }}>
            <h2>공유된 테스트 결과</h2>

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
                                justifyContent: 'space-between',
                                gap: '0.75rem',
                                color: 'var(--text-secondary)',
                            }}
                        >
                            <small>
                                {post.writerEmail} ·{' '}
                                {formatDate(post.createdAt)}
                            </small>

                            {/* 실제 테스트 요청과 연결된 게시글인지 표시합니다. */}
                            {post.testRequestId && (
                                <small style={{ color: 'var(--success)' }}>
                                    테스트 결과 연결 완료
                                </small>
                            )}
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}