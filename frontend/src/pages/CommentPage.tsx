import {
    useCallback,
    useEffect,
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
    ForumCommentThread,
    ForumPostDetail,
    getForumLikeCount,
    getForumWriter,
} from '../components/community';

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

    /**
     * 기존 게시판 기능은 유지하면서 커뮤니티 탭 경로를 사용할지 결정합니다.
     */
    integrated?: boolean;
}

export default function CommentPage({
    currentUser,
    showAlert,
    integrated = false,
}: CommentPageProps) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const listPath = integrated
        ? '/community?tab=free'
        : '/comment';

    const writePath = integrated
        ? '/community/free/write'
        : '/comment/write';

    const detailPath = (postId: number) =>
        integrated
            ? `${listPath}&postId=${postId}`
            : `${listPath}?postId=${postId}`;

    const editPath = (postId: number) =>
        integrated
            ? `/community/free/${postId}/edit`
            : `/comment/${postId}/edit`;

    const postIdParam =
        searchParams.get('postId');

    const [posts, setPosts] =
        useState<ForumPost[]>([]);

    const [selectedPost, setSelectedPost] =
        useState<ForumPost | null>(null);

    const [comments, setComments] =
        useState<ForumComment[]>([]);

    const [commentValue, setCommentValue] =
        useState('');

    const [replyValue, setReplyValue] =
        useState('');

    const [replyParentId, setReplyParentId] =
        useState<number | null>(null);

    const [liked, setLiked] =
        useState(false);

    const [page, setPage] =
        useState(1);

    const [totalPages, setTotalPages] =
        useState(1);

    const [totalElements, setTotalElements] =
        useState(0);

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

    /*
     * 로그인 사용자 권한
     */
    const loginUserEmail =
        normalizeEmail(currentUser.email);

    const isAdmin =
        hasAdminRole(currentUser.role);

    /*
     * 선택된 게시글 작성자
     */
    const selectedPostWriterEmail =
        selectedPost
            ? normalizeEmail(
                getForumWriter(selectedPost),
            )
            : '';

    /*
     * 작성자 여부
     */
    const isPostOwner = Boolean(
        selectedPost &&
        loginUserEmail &&
        selectedPostWriterEmail &&
        loginUserEmail === selectedPostWriterEmail,
    );

    /*
     * 삭제 권한
     *
     * 작성자 또는 관리자
     */
    const canDeletePost =
        isPostOwner || isAdmin;

    /*
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
                Math.max(data.totalPages ?? 1, 1),
            );

            setTotalElements(
                data.totalElements ?? data.content?.length ?? 0,
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

    /*
     * 상세 상태 초기화
     */
    const resetPostDetail =
        useCallback(() => {
            setSelectedPost(null);
            setComments([]);
            setLiked(false);

            setCommentValue('');
            setReplyValue('');
            setReplyParentId(null);
        }, []);

    /*
     * 게시글 상세 불러오기
     */
    const loadPostDetail = useCallback(
        async (postId: number) => {
            try {
                setDetailLoading(true);

                const [
                    nextPost,
                    nextComments,
                    likeStatus,
                ] = await Promise.all([
                    getPost(postId),
                    getComments(postId),
                    getLikeStatus(postId),
                ]);

                setSelectedPost(nextPost);
                setComments(nextComments);
                setLiked(likeStatus.liked);

                setCommentValue('');
                setReplyValue('');
                setReplyParentId(null);
            } catch (openError) {
                const message = getErrorMessage(
                    openError,
                    '게시글 상세 정보를 불러오지 못했습니다.',
                );

                showAlert(message, 'error');

                resetPostDetail();

                navigate(listPath, {
                    replace: true,
                });
            } finally {
                setDetailLoading(false);
            }
        },
        [
            navigate,
            listPath,
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

        const postId = Number(postIdParam);

        if (
            !Number.isInteger(postId) ||
            postId <= 0
        ) {
            resetPostDetail();

            navigate(listPath, {
                replace: true,
            });

            return;
        }

        void loadPostDetail(postId);
    }, [
        loadPostDetail,
        listPath,
        navigate,
        postIdParam,
        resetPostDetail,
    ]);

    /*
     * 게시글 열기
     */
    const openPost = (
        postId: number,
    ) => {
        navigate(detailPath(postId));
    };

    /*
     * 목록으로 이동
     */
    const handleBackToList = () => {
        resetPostDetail();

        navigate(listPath, {
            replace: true,
        });
    };

    /*
     * 상세 게시글 새로고침
     */
    const refreshDetail = async (
        postId: number,
    ) => {
        const [
            nextPost,
            nextComments,
        ] = await Promise.all([
            getPost(postId),
            getComments(postId),
        ]);

        setSelectedPost(nextPost);
        setComments(nextComments);

        await loadPosts();
    };

    /*
     * 수정 권한 검사
     *
     * 수정은 작성자만 가능합니다.
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

    /*
     * 삭제 권한 검사
     *
     * 작성자 또는 관리자가 삭제할 수 있습니다.
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

    /*
     * 좋아요 처리
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

    /*
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
            editPath(selectedPost.id),
            {
                state: {
                    returnTo: detailPath(selectedPost.id),
                },
            },
        );
    };

    /*
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

            navigate(listPath, {
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

    /*
     * 댓글 등록
     */
    const submitComment = async (
        event: FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();

        const content =
            commentValue.trim();

        if (
            !selectedPost ||
            !content
        ) {
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

    /*
     * 답글 등록
     */
    const submitReply = async (
        event: FormEvent<HTMLFormElement>,
        parentId: number,
    ) => {
        event.preventDefault();

        const content =
            replyValue.trim();

        if (
            !selectedPost ||
            !content
        ) {
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

    /*
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

    /*
     * 페이지 번호
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

    /*
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
                    comments={comments}
                    currentUserEmail={
                        currentUser.email
                    }
                    value={commentValue}
                    replyValue={replyValue}
                    replyParentId={
                        replyParentId
                    }
                    onValueChange={
                        setCommentValue
                    }
                    onReplyValueChange={
                        setReplyValue
                    }
                    onSubmit={submitComment}
                    onSubmitReply={
                        submitReply
                    }
                    onToggleReply={(id) => {
                        setReplyParentId(id);
                        setReplyValue('');
                    }}
                    onDelete={(
                        id,
                        isReply,
                    ) =>
                        void removeComment(
                            id,
                            isReply,
                        )
                    }
                />
            </div>
        );
    }

    /*
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
                            navigate(writePath)
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
                                                    <span>{post.title}</span>

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
                                                {post.createdAt?.slice(0, 10)}
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
