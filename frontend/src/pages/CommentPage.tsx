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

interface CommentPageProps {
    currentUser: {
        id: string;
        email: string;
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

    /*
     * 상세 게시글 ID를 React 상태에만 저장하지 않고
     * URL에도 저장합니다.
     *
     * 예:
     * 목록: /comment
     * 상세: /comment?postId=15
     *
     * 이렇게 해야 브라우저 뒤로가기 버튼을 눌렀을 때
     * 이전 커뮤니티나 대시보드가 아니라 /comment 목록으로 돌아옵니다.
     */
    const postIdParam = searchParams.get('postId');

    const [posts, setPosts] = useState<ForumPost[]>([]);
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
                return;
            }

            setPosts(data.content || []);
            setTotalPages(data.totalPages || 1);
        } catch (loadError) {
            const message =
                loadError instanceof Error
                    ? loadError.message
                    : '게시글 목록을 불러오지 못했습니다.';

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
     * 상세 화면에서 사용하던 상태 초기화
     */
    const resetPostDetail = useCallback(() => {
        setSelectedPost(null);
        setComments([]);
        setLiked(false);

        setCommentValue('');
        setReplyValue('');
        setReplyParentId(null);
    }, []);

    /**
     * 게시글 상세 불러오기
     */
    const loadPostDetail = useCallback(
        async (postId: number) => {
            try {
                setDetailLoading(true);

                const [
                    post,
                    postComments,
                    likeStatus,
                ] = await Promise.all([
                    getPost(postId),
                    getComments(postId),
                    getLikeStatus(postId),
                ]);

                setSelectedPost(post);
                setComments(postComments);
                setLiked(likeStatus.liked);

                setCommentValue('');
                setReplyValue('');
                setReplyParentId(null);
            } catch (openError) {
                const message =
                    openError instanceof Error
                        ? openError.message
                        : '게시글 상세 정보를 불러오지 못했습니다.';

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

    /*
     * URL의 postId가 바뀔 때 상세 게시글을 불러옵니다.
     *
     * 브라우저 뒤로가기:
     * /comment?postId=15 -> /comment
     *
     * postId가 사라지면 상세 상태를 비우고 목록을 보여줍니다.
     */
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

            navigate('/comment', {
                replace: true,
            });

            return;
        }

        void loadPostDetail(postId);
    }, [
        loadPostDetail,
        navigate,
        postIdParam,
        resetPostDetail,
    ]);

    /**
     * 목록에서 게시글 열기
     *
     * URL을 변경해서 브라우저 방문 기록에
     * 게시글 상세 화면을 남깁니다.
     */
    const openPost = (
        postId: number,
    ) => {
        navigate(
            `/comment?postId=${postId}`,
        );
    };

    /**
     * 화면 안의 "게시판 목록으로" 버튼
     *
     * replace를 사용해 상세 주소를 목록 주소로 교체합니다.
     */
    const handleBackToList = () => {
        resetPostDetail();

        navigate('/comment', {
            replace: true,
        });
    };

    /**
     * 게시글 상세 내용 새로고침
     */
    const refreshDetail = async (
        postId: number,
    ) => {
        const [
            post,
            postComments,
        ] = await Promise.all([
            getPost(postId),
            getComments(postId),
        ]);

        setSelectedPost(post);
        setComments(postComments);

        await loadPosts();
    };

    /**
     * 현재 로그인한 사용자가 작성자인지 확인
     */
    const checkOwner = async () => {
        if (!selectedPost) {
            return false;
        }

        const currentUserEmail =
            currentUser.email
                .trim()
                .toLowerCase();

        const writerEmail =
            getForumWriter(selectedPost)
                .trim()
                .toLowerCase();

        const allowed =
            currentUserEmail === writerEmail;

        if (!allowed) {
            await showWarningAlert(
                '권한이 없습니다.',
                '본인이 작성한 게시글만 변경할 수 있습니다.',
            );
        }

        return allowed;
    };

    /**
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
            const message =
                likeError instanceof Error
                    ? likeError.message
                    : '좋아요 처리에 실패했습니다.';

            showAlert(message, 'error');
        }
    };

    /**
     * 게시글 수정 페이지로 이동
     */
    const editPost = async () => {
        if (!selectedPost) {
            return;
        }

        const allowed =
            await checkOwner();

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
            await checkOwner();

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
                '게시글이 삭제되었습니다.',
            );
        } catch (deleteError) {
            const message =
                deleteError instanceof Error
                    ? deleteError.message
                    : '게시글 삭제에 실패했습니다.';

            await showErrorAlert(
                '삭제 실패',
                message,
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

        if (
            !selectedPost ||
            !commentValue.trim()
        ) {
            return;
        }

        try {
            await createComment(
                selectedPost.id,
                {
                    content:
                        commentValue.trim(),
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
        } catch {
            await showErrorAlert(
                '댓글 등록 실패',
                '댓글 작성 중 오류가 발생했습니다.',
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

        if (
            !selectedPost ||
            !replyValue.trim()
        ) {
            return;
        }

        try {
            await createComment(
                selectedPost.id,
                {
                    content:
                        replyValue.trim(),
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
        } catch {
            await showErrorAlert(
                '답글 등록 실패',
                '답글 작성 중 오류가 발생했습니다.',
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

        const confirmed =
            await showConfirmAlert({
                title: `${isReply ? '답글' : '댓글'
                    }을 삭제하시겠습니까?`,
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
                `${isReply ? '답글' : '댓글'
                }이 삭제되었습니다.`,
            );
        } catch (deleteError) {
            const message =
                deleteError instanceof Error
                    ? deleteError.message
                    : '삭제 중 오류가 발생했습니다.';

            await showErrorAlert(
                '삭제 실패',
                message,
            );
        }
    };

    /**
     * 페이지 번호 계산
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

    /**
     * 게시글 상세 로딩 화면
     */
    if (postIdParam && detailLoading && !selectedPost) {
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
                    onEdit={() =>
                        void editPost()
                    }
                    onDelete={() =>
                        void removePost()
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
                            navigate(
                                '/comment/write',
                            )
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
                                {posts.map(
                                    (post) => (
                                        <tr key={post.id}>
                                            <td>
                                                {post.id}
                                            </td>

                                            <td>
                                                <button
                                                    type="button"
                                                    className="community-table-link"
                                                    onClick={() =>
                                                        openPost(
                                                            post.id,
                                                        )
                                                    }
                                                >
                                                    {post.title}
                                                </button>
                                            </td>

                                            <td>
                                                {getForumWriter(
                                                    post,
                                                )}
                                            </td>

                                            <td>
                                                {post.createdAt?.slice(
                                                    0,
                                                    10,
                                                )}
                                            </td>

                                            <td>
                                                {getForumLikeCount(
                                                    post,
                                                )}
                                            </td>

                                            <td>
                                                {post.commentCount ??
                                                    0}
                                            </td>
                                        </tr>
                                    ),
                                )}
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