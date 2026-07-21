import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchCommunityPosts } from '../../api/communityPostApi';
import { COMMUNITY_LIMITS } from '../../constants/communityLimits';
import type { Post } from '../../types/post';
import { Badge, Card, EmptyState } from '../common';
import { CommunityAuthor } from './CommunityPostList';
import CommunityPostPagination from './CommunityPostPagination';

// 작성자에게만 수정·삭제 기능을 제공합니다.
import CommunityPostActions from './CommunityPostActions';



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

function getContentPreview(value: string): string {
    const content = value.trim();
    if (content.length <= COMMUNITY_LIMITS.POST_PREVIEW) return content;
    return `${content.slice(0, COMMUNITY_LIMITS.POST_PREVIEW).trimEnd()}…`;
}

// 한 페이지에 표시할 테스트 공유 게시글 수입니다.
const PAGE_SIZE = 5;

export default function TestSharePostList({
    refreshKey,
}: TestSharePostListProps) {
    const [posts, setPosts] = useState<Post[]>([]);

    // Spring 페이지 번호는 0부터 시작합니다.
    const [currentPage, setCurrentPage] = useState(0);

    // 서버가 알려주는 전체 페이지 수입니다.
    const [totalPages, setTotalPages] = useState(0);

    // 게시글 삭제 후 현재 페이지를 다시 불러오기 위한 값입니다.
    const [reloadKey, setReloadKey] = useState(0);

    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        /*
         * 새 테스트 공유글이 작성되어 refreshKey가 변경되면
         * 최신 게시글이 있는 첫 번째 페이지로 이동합니다.
         */
        setCurrentPage(0);
    }, [refreshKey]);

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

                    // 사용자가 선택한 페이지를 서버에 요청합니다.
                    page: currentPage,

                    // 한 페이지에 테스트 공유글 5개만 요청합니다.
                    size: PAGE_SIZE,

                    sort: 'createdAt,desc',
                });

                if (!cancelled) {
                    /*
                     * 마지막 페이지의 마지막 게시글을 삭제하면
                     * 현재 페이지 번호가 전체 페이지 범위를 벗어날 수 있습니다.
                     */
                    const lastPageIndex = Math.max(
                        page.totalPages - 1,
                        0
                    );

                    if (
                        page.content.length === 0 &&
                        currentPage > lastPageIndex
                    ) {
                        setCurrentPage(lastPageIndex);
                        return;
                    }

                    // 서버에서 받은 현재 페이지 게시글을 저장합니다.
                    setPosts(page.content);

                    // 이전·다음 버튼에 사용할 전체 페이지 수를 저장합니다.
                    setTotalPages(page.totalPages);
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
    }, [refreshKey, currentPage, reloadKey]);

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
        <section
            className="community-post-section"
            aria-labelledby="community-test-share-heading"
        >
            <h2 id="community-test-share-heading">
                공유된 테스트 결과
            </h2>

            <div className="community-shared-post-list">
                {posts.map((post) => (
                    <Card
                        as="article"
                        key={post.id}
                        variant="outlined"
                        className="community-shared-post-card"
                    >
                        <h3 className="community-shared-post-card__title">
                            {/* 제목을 클릭하면 새 커뮤니티 상세 페이지로 이동합니다. */}
                            <Link
                                to={`/community/${post.id}`}
                                className="community-shared-post-card__title-link"
                            >
                                {post.title}
                            </Link>
                        </h3>

                        {/* 소개글이 있는 게시글에서만 본문을 표시합니다. */}
                        {post.content.trim() && (
                            <>
                                <p className="community-shared-post-card__content">
                                    {getContentPreview(post.content)}
                                </p>
                                {post.content.trim().length > COMMUNITY_LIMITS.POST_PREVIEW && (
                                    <Link
                                        to={`/community/${post.id}`}
                                        className="community-shared-post-card__read-more"
                                    >
                                        전체 내용 보기
                                    </Link>
                                )}
                            </>
                        )}
                        <div className="community-shared-post-card__footer">
                            <small className="community-shared-post-card__byline">
                                <CommunityAuthor
                                    email={post.writerEmail}
                                    avatarUrl={post.writerAvatarUrl}
                                />
                                <time dateTime={post.createdAt}>
                                    {formatDate(post.createdAt)}
                                </time>
                            </small>

                            <div className="community-shared-post-card__controls">
                                <CommunityPostActions
                                    post={post}
                                    onUpdated={(updatedPost) => {
                                        /*
                                         * 수정된 테스트 공유글을 목록에 반영합니다.
                                         */
                                        setPosts((currentPosts) =>
                                            currentPosts.map((currentPost) =>
                                                currentPost.id === updatedPost.id
                                                    ? updatedPost
                                                    : currentPost
                                            )
                                        );
                                    }}
                                    onDeleted={() => {
                                        /*
                                         * 삭제 후 서버에서 현재 페이지를 다시 조회합니다.
                                         * 다음 페이지 게시글이 현재 페이지로 이동하는 것도 반영됩니다.
                                         */
                                        setReloadKey(
                                            (currentKey) => currentKey + 1
                                        );
                                    }}
                                />

                                {/* 수정·삭제 액션 아래에 테스트 연결 상태를 표시합니다. */}
                                {post.testRequestId && (
                                    <Badge tone="success">
                                        테스트 결과 연결 완료
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <CommunityPostPagination
                ariaLabel="테스트 공유 게시글 페이지"
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />
        </section>
    );
}
