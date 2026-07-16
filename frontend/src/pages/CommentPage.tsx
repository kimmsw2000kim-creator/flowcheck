import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type FormEvent,
} from 'react';
import {
    useNavigate,
    useSearchParams,
} from 'react-router-dom';

import {
    createComment,
    deleteComment,
    deletePost,
    getComments,
    getLikeStatus,
    getPost,
    getPosts,
    likePost,
} from '../api/communityApi';

import {
    Button,
    EmptyState,
    Field,
    PageHeader,
    Table,
    TableContainer,
} from '../components/common';

import {
    CommentPagination,
    COMMENTS_PER_PAGE,
    ForumCommentThread,
    ForumPostDetail,
    getForumLikeCount,
    getForumWriter,
} from '../components/community';

import { COMMUNITY_LIMITS } from '../constants/communityLimits';

import type {
    ForumComment,
    ForumPost,
} from '../types/community';

import {
    showConfirmAlert,
    showErrorAlert,
    showSuccessAlert,
    showWarningAlert,
} from '../utils/alert';

const normalizeEmail = (
    email?: string | null,
) => email?.trim().toLowerCase() ?? '';

const normalizeRole = (
    role?: string | null,
) => role?.trim().toUpperCase() ?? '';

const hasAdminRole = (
    role?: string | null,
) => {
    const normalizedRole = normalizeRole(role);

    return (
        normalizedRole === 'ADMIN' ||
        normalizedRole === 'ROLE_ADMIN'
    );
};

const getCommentCount = (
    post: ForumPost,
) => Number(post.commentCount ?? 0);

const getErrorMessage = (
    error: unknown,
    fallbackMessage: string,
) => {
    return error instanceof Error
        ? error.message
        : fallbackMessage;
};

/**
 * 댓글 또는 답글 등록 직전 입력값을 검사합니다.
 */
const validateCommentContent = async (
    content: string,
    type: '댓글' | '답글',
) => {
    const limit =
        type === '댓글'
            ? COMMUNITY_LIMITS.COMMENT
            : COMMUNITY_LIMITS.REPLY;

    if (!content) {
        await showWarningAlert(
            `${type}을 입력해 주세요.`,
            `${type} 내용은 비워둘 수 없습니다.`,
        );

        return false;
    }

    if (content.length > limit) {
        await showWarningAlert(
            `${type} 글자 수 초과`,
            `${type}은 최대 ${limit}자까지 입력할 수 있습니다.`,
        );

        return false;
    }

    return true;
};

interface CommentPageProps {
    currentUser: {
        id: string;
        email: string;
        role: string;
        balance: number;
        coupons: number;
    };

    showAlert: (
        message: string,
        type?: string,
    ) => void;
}

export default function CommentPage({
    currentUser,
    showAlert,
}: CommentPageProps) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const postIdParam =
        searchParams.get('postId');

    const [posts, setPosts] =
        useState<ForumPost[]>([]);

    const [selectedPost, setSelectedPost] =
        useState<ForumPost | null>(null);

    const [comments, setComments] =
        useState<ForumComment[]>([]);

    /**
     * 게시글 목록 페이징
     */
    const [page, setPage] =
        useState(1);

    const [totalPages, setTotalPages] =
        useState(1);

    const [totalElements, setTotalElements] =
        useState(0);

    /**
     * 댓글 페이징
     */
    const [commentPage, setCommentPage] =
        useState(1);

    const [commentValue, setCommentValue] =
        useState('');

    const [replyValue, setReplyValue] =
        useState('');

    const [replyParentId, setReplyParentId] =
        useState<number | null>(null);

    const [liked, setLiked] =
        useState(false);

    const [searchInput, setSearchInput] =
        useState('');

    const [keyword, setKeyword] =
        useState('');

    const [loading, setLoading] =
        useState(true);

    const [detailLoading, setDetailLoading] =
        useState(false);

    const [error, setError] =
        useState('');

    /**
     * 입력 제한 경고 중복 방지
     */
    const commentLimitWarnedRef =
        useRef(false);

    const replyLimitWarnedRef =
        useRef(false);

    /**
     * 댓글 20개 단위 페이징
     */
    const totalCommentPages = Math.max(
        1,
        Math.ceil(
            comments.length / COMMENTS_PER_PAGE,
        ),
    );

    const paginatedComments = comments.slice(
        (commentPage - 1) * COMMENTS_PER_PAGE,
        commentPage * COMMENTS_PER_PAGE,
    );

    /**
     * 로그인 사용자 정보
     */
    const loginUserEmail =
        normalizeEmail(currentUser.email);

    const isAdmin =
        hasAdminRole(currentUser.role);

    /**
     * 선택된 게시글 작성자
     */
    const selectedPostWriterEmail =
        selectedPost
            ? normalizeEmail(
                getForumWriter(selectedPost),
            )
            : '';

    const isPostOwner = Boolean(
        selectedPost &&
        loginUserEmail &&
        selectedPostWriterEmail &&
        loginUserEmail === selectedPostWriterEmail,
    );

    const canDeletePost =
        isPostOwner || isAdmin;

    /**
     * 댓글 입력 중 500자를 초과하면 즉시 경고합니다.
     */
    const handleCommentValueChange = (
        nextValue: string,
    ) => {
        const limit = COMMUNITY_LIMITS.COMMENT;

        if (nextValue.length <= limit) {
            setCommentValue(nextValue);
            commentLimitWarnedRef.current = false;
            return;
        }

        setCommentValue(
            nextValue.slice(0, limit),
        );

        if (commentLimitWarnedRef.current) {
            return;
        }

        commentLimitWarnedRef.current = true;

        void showWarningAlert(
            '댓글 글자 수 초과',
            `댓글은 최대 ${limit}자까지 입력할 수 있습니다.`,
        );
    };

    /**
     * 답글 입력 중 500자를 초과하면 즉시 경고합니다.
     */
    const handleReplyValueChange = (
        nextValue: string,
    ) => {
        const limit = COMMUNITY_LIMITS.REPLY;

        if (nextValue.length <= limit) {
            setReplyValue(nextValue);
            replyLimitWarnedRef.current = false;
            return;
        }

        setReplyValue(
            nextValue.slice(0, limit),
        );

        if (replyLimitWarnedRef.current) {
            return;
        }

        replyLimitWarnedRef.current = true;

        void showWarningAlert(
            '답글 글자 수 초과',
            `답글은 최대 ${limit}자까지 입력할 수 있습니다.`,
        );
    };

    /**
     * 게시글 목록 불러오기
     */
    const loadPosts = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            const data = await getPosts(
                page - 1,
                10,
                keyword,
            );

            if (Array.isArray(data)) {
                setPosts(data);
                setTotalPages(1);
                setTotalElements(data.length);
                return;
            }

            setPosts(data.content ?? []);

            setTotalPages(
                Math.max(
                    data.totalPages ?? 1,
                    1,
                ),
            );

            setTotalElements(
                data.totalElements ??
                data.content?.length ??
                0,
            );
        } catch (loadError) {
            const message = getErrorMessage(
                loadError,
                '게시글 목록을 불러오지 못했습니다.',
            );

            setError(message);
            showAlert(message, 'error');
        } finally {
            setLoading(false);
        }
    }, [
        keyword,
        page,
        showAlert,
    ]);

    /**
     * 상세 화면 상태 초기화
     */
    const resetPostDetail =
        useCallback(() => {
            setSelectedPost(null);
            setComments([]);
            setLiked(false);

            setCommentPage(1);
            setCommentValue('');
            setReplyValue('');
            setReplyParentId(null);

            commentLimitWarnedRef.current = false;
            replyLimitWarnedRef.current = false;
        }, []);

    /**
     * 게시글 상세 불러오기
     */
    const loadPostDetail = useCallback(
        async (targetPostId: number) => {
            try {
                setDetailLoading(true);

                const [
                    nextPost,
                    nextComments,
                    likeStatus,
                ] = await Promise.all([
                    getPost(targetPostId),
                    getComments(targetPostId),

                    getLikeStatus(targetPostId)
                        .catch(() => ({
                            liked: false,
                        })),
                ]);

                setSelectedPost(nextPost);
                setComments(nextComments);
                setLiked(likeStatus.liked);

                setCommentPage(1);
                setCommentValue('');
                setReplyValue('');
                setReplyParentId(null);

                commentLimitWarnedRef.current = false;
                replyLimitWarnedRef.current = false;
            } catch (openError) {
                const message = getErrorMessage(
                    openError,
                    '게시글 상세 정보를 불러오지 못했습니다.',
                );

                showAlert(message, 'error');

                resetPostDetail();

                navigate('/comment', {
                    replace: true,
                });
            } finally {
                setDetailLoading(false);
            }
        },
        [
            navigate,
            resetPostDetail,
            showAlert,
        ],
    );

    useEffect(() => {
        void loadPosts();
    }, [loadPosts]);

    useEffect(() => {
        if (!postIdParam) {
            resetPostDetail();
            return;
        }

        const targetPostId = Number(postIdParam);

        if (
            !Number.isInteger(targetPostId) ||
            targetPostId <= 0
        ) {
            resetPostDetail();

            navigate('/comment', {
                replace: true,
            });

            return;
        }

        void loadPostDetail(targetPostId);
    }, [
        loadPostDetail,
        navigate,
        postIdParam,
        resetPostDetail,
    ]);

    /**
     * 댓글 삭제로 전체 댓글 페이지 수가 줄었을 때
     * 현재 페이지를 유효한 범위로 조정합니다.
     */
    useEffect(() => {
        setCommentPage((currentPage) =>
            Math.min(
                Math.max(currentPage, 1),
                totalCommentPages,
            ),
        );
    }, [totalCommentPages]);

    /**
     * 검색 등으로 게시글 전체 페이지 수가 줄었을 때
     * 현재 페이지를 유효한 범위로 조정합니다.
     */
    useEffect(() => {
        setPage((currentPage) =>
            Math.min(
                Math.max(currentPage, 1),
                totalPages,
            ),
        );
    }, [totalPages]);

    const openPost = (
        targetPostId: number,
    ) => {
        navigate(
            `/comment?postId=${targetPostId}`,
        );
    };

    const handleBackToList = () => {
        resetPostDetail();

        navigate('/comment', {
            replace: true,
        });
    };

    /**
     * 상세 게시글과 게시글 목록 새로고침
     */
    const refreshDetail = async (
        targetPostId: number,
    ) => {
        const [
            nextPost,
            nextComments,
        ] = await Promise.all([
            getPost(targetPostId),
            getComments(targetPostId),
        ]);

        setSelectedPost(nextPost);
        setComments(nextComments);

        await loadPosts();
    };

    /**
     * 수정 권한 확인
     */
    const checkEditPermission =
        async () => {
            if (!selectedPost) {
                return false;
            }

            if (!isPostOwner) {
                await showWarningAlert(
                    '권한이 없습니다.',
                    '본인이 작성한 게시글만 수정할 수 있습니다.',
                );

                return false;
            }

            return true;
        };

    /**
     * 삭제 권한 확인
     */
    const checkDeletePermission =
        async () => {
            if (!selectedPost) {
                return false;
            }

            if (!canDeletePost) {
                await showWarningAlert(
                    '권한이 없습니다.',
                    '작성자 또는 관리자만 게시글을 삭제할 수 있습니다.',
                );

                return false;
            }

            return true;
        };

    /**
     * 좋아요 등록 또는 취소
     */
    const toggleLike = async () => {
        if (!selectedPost) {
            return;
        }

        try {
            const result =
                await likePost(selectedPost.id);

            setLiked(result.liked);

            setSelectedPost(
                (previousPost) => {
                    if (!previousPost) {
                        return null;
                    }

                    return {
                        ...previousPost,
                        likeCount: result.likeCount,
                        likes: result.likeCount,
                    };
                },
            );

            await loadPosts();

            showAlert(
                result.message,
                result.liked
                    ? 'success'
                    : 'info',
            );
        } catch (likeError) {
            showAlert(
                getErrorMessage(
                    likeError,
                    '좋아요 처리에 실패했습니다.',
                ),
                'error',
            );
        }
    };

    /**
     * 게시글 수정
     */
    const editPost = async () => {
        if (!selectedPost) {
            return;
        }

        const allowed =
            await checkEditPermission();

        if (!allowed) {
            return;
        }

        navigate(
            `/comment/${selectedPost.id}/edit`,
            {
                state: {
                    returnTo:
                        `/comment?postId=${selectedPost.id}`,
                },
            },
        );
    };

    /**
     * 게시글 삭제
     */
    const removePost = async () => {
        if (!selectedPost) {
            return;
        }

        const allowed =
            await checkDeletePermission();

        if (!allowed) {
            return;
        }

        const confirmed =
            await showConfirmAlert({
                title:
                    '게시글을 삭제하시겠습니까?',
                text:
                    '댓글과 좋아요 정보도 함께 삭제됩니다.',
                confirmText: '삭제',
                cancelText: '취소',
                danger: true,
            });

        if (!confirmed) {
            return;
        }

        try {
            await deletePost(selectedPost.id);

            resetPostDetail();

            navigate('/comment', {
                replace: true,
            });

            await loadPosts();

            await showSuccessAlert(
                '삭제 완료',
                isAdmin && !isPostOwner
                    ? '관리자 권한으로 게시글을 삭제했습니다.'
                    : '게시글이 삭제되었습니다.',
            );
        } catch (deleteError) {
            await showErrorAlert(
                '삭제 실패',
                getErrorMessage(
                    deleteError,
                    '게시글 삭제에 실패했습니다.',
                ),
            );
        }
    };

    /**
     * 댓글 등록
     */
    const submitComment = async (
        event: FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();

        if (!selectedPost) {
            return;
        }

        const content =
            commentValue.trim();

        const valid =
            await validateCommentContent(
                content,
                '댓글',
            );

        if (!valid) {
            return;
        }

        try {
            await createComment(
                selectedPost.id,
                {
                    content,
                    parentId: null,
                },
            );

            setCommentValue('');
            setCommentPage(1);

            commentLimitWarnedRef.current = false;

            await refreshDetail(
                selectedPost.id,
            );

            await showSuccessAlert(
                '댓글 등록 완료',
                '댓글이 정상적으로 등록되었습니다.',
            );
        } catch (commentError) {
            await showErrorAlert(
                '댓글 등록 실패',
                getErrorMessage(
                    commentError,
                    '댓글 작성 중 오류가 발생했습니다.',
                ),
            );
        }
    };

    /**
     * 답글 등록
     */
    const submitReply = async (
        event: FormEvent<HTMLFormElement>,
        parentId: number,
    ) => {
        event.preventDefault();

        if (!selectedPost) {
            return;
        }

        const content =
            replyValue.trim();

        const valid =
            await validateCommentContent(
                content,
                '답글',
            );

        if (!valid) {
            return;
        }

        try {
            await createComment(
                selectedPost.id,
                {
                    content,
                    parentId,
                },
            );

            setReplyValue('');
            setReplyParentId(null);

            replyLimitWarnedRef.current = false;

            await refreshDetail(
                selectedPost.id,
            );

            await showSuccessAlert(
                '답글 등록 완료',
                '답글이 정상적으로 등록되었습니다.',
            );
        } catch (replyError) {
            await showErrorAlert(
                '답글 등록 실패',
                getErrorMessage(
                    replyError,
                    '답글 작성 중 오류가 발생했습니다.',
                ),
            );
        }
    };

    /**
     * 댓글 또는 답글 삭제
     */
    const removeComment = async (
        commentId: number,
        isReply = false,
    ) => {
        if (!selectedPost) {
            return;
        }

        const commentType =
            isReply ? '답글' : '댓글';

        const confirmed =
            await showConfirmAlert({
                title:
                    `${commentType}을 삭제하시겠습니까?`,
                text:
                    '삭제한 내용은 복구할 수 없습니다.',
                confirmText: '삭제',
                cancelText: '취소',
                danger: true,
            });

        if (!confirmed) {
            return;
        }

        try {
            await deleteComment(commentId);

            await refreshDetail(
                selectedPost.id,
            );

            await showSuccessAlert(
                '삭제 완료',
                `${commentType}이 삭제되었습니다.`,
            );
        } catch (deleteError) {
            await showErrorAlert(
                '삭제 실패',
                getErrorMessage(
                    deleteError,
                    `${commentType} 삭제 중 오류가 발생했습니다.`,
                ),
            );
        }
    };

    /**
     * 게시글 목록 페이지 번호
     */
    const pageGroupStart =
        Math.floor((page - 1) / 10) * 10 + 1;

    const pageNumbers =
        Array.from(
            {
                length: Math.max(
                    0,
                    Math.min(
                        10,
                        totalPages - pageGroupStart + 1,
                    ),
                ),
            },
            (_, index) =>
                pageGroupStart + index,
        );

    if (
        postIdParam &&
        detailLoading &&
        !selectedPost
    ) {
        return (
            <div className="community-page">
                <EmptyState
                    title="게시글을 불러오는 중입니다."
                    description="잠시만 기다려 주세요."
                    aria-live="polite"
                />
            </div>
        );
    }

    /**
     * 게시글 상세 화면
     */
    if (selectedPost) {
        return (
            <div className="community-page">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={handleBackToList}
                >
                    ← 게시판 목록으로
                </Button>

                <ForumPostDetail
                    post={selectedPost}
                    liked={liked}
                    onLike={() =>
                        void toggleLike()
                    }
                    onEdit={
                        isPostOwner
                            ? () => void editPost()
                            : undefined
                    }
                    onDelete={
                        canDeletePost
                            ? () => void removePost()
                            : undefined
                    }
                />

                <ForumCommentThread
                    comments={paginatedComments}
                    commentCount={selectedPost?.commentCount ?? 0}
                    currentUserEmail={loginUserEmail}
                    value={commentValue}
                    replyValue={replyValue}
                    replyParentId={replyParentId}
                    onValueChange={handleCommentValueChange}
                    onReplyValueChange={handleReplyValueChange}
                    onSubmit={submitComment}
                    onSubmitReply={submitReply}
                    onToggleReply={(nextId) => {
                        setReplyParentId(nextId);
                        setReplyValue('');
                        replyLimitWarnedRef.current = false;
                    }}
                    onDelete={(commentId, isReply) =>
                        void removeComment(commentId, isReply)
                    }
                />

                <CommentPagination
                    currentPage={commentPage}
                    totalPages={totalCommentPages}
                    onPageChange={(nextPage) => {
                        setCommentPage(nextPage);
                        setReplyParentId(null);
                        setReplyValue('');

                        replyLimitWarnedRef.current = false;
                    }}
                />
            </div>
        );
    }

    /**
     * 게시글 목록 화면
     */
    return (
        <div className="community-page">
            <PageHeader
                eyebrow="Community"
                title="자유게시판"
                description="질문과 경험을 자유롭게 나누어 보세요."
                actions={
                    <Button
                        type="button"
                        onClick={() =>
                            navigate('/comment/write')
                        }
                    >
                        게시글 작성
                    </Button>
                }
            />

            <form
                className="community-search"
                role="search"
                onSubmit={(event) => {
                    event.preventDefault();

                    setPage(1);

                    setKeyword(
                        searchInput.trim(),
                    );
                }}
            >
                <Field
                    label="게시글 검색"
                    htmlFor="comment-search-input"
                >
                    <input
                        id="comment-search-input"
                        className="fc-input"
                        value={searchInput}
                        onChange={(event) =>
                            setSearchInput(
                                event.target.value,
                            )
                        }
                        placeholder="제목 또는 작성자 이메일"
                    />
                </Field>

                <Button type="submit">
                    검색
                </Button>

                {keyword && (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                            setSearchInput('');
                            setKeyword('');
                            setPage(1);
                        }}
                    >
                        초기화
                    </Button>
                )}
            </form>

            {loading && (
                <EmptyState
                    title="게시글을 불러오는 중입니다."
                    description="잠시만 기다려 주세요."
                    aria-live="polite"
                />
            )}

            {!loading && error && (
                <EmptyState
                    title={error}
                    action={
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                void loadPosts()
                            }
                        >
                            다시 시도
                        </Button>
                    }
                />
            )}

            {!loading &&
                !error &&
                posts.length === 0 && (
                    <EmptyState
                        title={
                            keyword
                                ? '검색 결과가 없습니다.'
                                : '등록된 게시글이 없습니다.'
                        }
                        description="첫 번째 이야기를 작성해 보세요."
                    />
                )}

            {!loading &&
                !error &&
                posts.length > 0 && (
                    <TableContainer>
                        <Table density="compact">
                            <thead>
                                <tr>
                                    <th scope="col">
                                        번호
                                    </th>

                                    <th scope="col">
                                        제목
                                    </th>

                                    <th scope="col">
                                        작성자
                                    </th>

                                    <th scope="col">
                                        날짜
                                    </th>

                                    <th scope="col">
                                        좋아요
                                    </th>

                                    <th scope="col">
                                        댓글
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {posts.map((post, index) => {
                                    const displayNumber =
                                        totalElements -
                                        (page - 1) * 10 -
                                        index;

                                    const commentCount =
                                        getCommentCount(post);

                                    return (
                                        <tr key={post.id}>
                                            <td>
                                                {displayNumber}
                                            </td>

                                            <td>
                                                <button
                                                    type="button"
                                                    className="community-table-link"
                                                    onClick={() =>
                                                        openPost(post.id)
                                                    }
                                                >
                                                    <span>
                                                        {post.title}
                                                    </span>

                                                    {commentCount > 0 && (
                                                        <span
                                                            className="community-title-comment-count"
                                                            aria-label={`댓글 ${commentCount}개`}
                                                        >
                                                            [{commentCount}]
                                                        </span>
                                                    )}
                                                </button>
                                            </td>

                                            <td>
                                                {getForumWriter(post)}
                                            </td>

                                            <td>
                                                {post.createdAt?.slice(
                                                    0,
                                                    10,
                                                )}
                                            </td>

                                            <td>
                                                {getForumLikeCount(post)}
                                            </td>

                                            <td>
                                                {commentCount}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </Table>
                    </TableContainer>
                )}

            {totalPages > 1 && (
                <nav
                    className="community-pagination"
                    aria-label="게시글 페이지"
                >
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={page === 1}
                        onClick={() =>
                            setPage(
                                (currentPage) =>
                                    currentPage - 1,
                            )
                        }
                    >
                        이전
                    </Button>

                    {pageNumbers.map(
                        (number) => (
                            <Button
                                type="button"
                                key={number}
                                variant={
                                    page === number
                                        ? 'primary'
                                        : 'secondary'
                                }
                                size="sm"
                                aria-current={
                                    page === number
                                        ? 'page'
                                        : undefined
                                }
                                onClick={() =>
                                    setPage(number)
                                }
                            >
                                {number}
                            </Button>
                        ),
                    )}

                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={
                            page === totalPages
                        }
                        onClick={() =>
                            setPage(
                                (currentPage) =>
                                    currentPage + 1,
                            )
                        }
                    >
                        다음
                    </Button>
                </nav>
            )}
        </div>
    );
}