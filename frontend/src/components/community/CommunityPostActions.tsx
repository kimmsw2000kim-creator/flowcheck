import { useState, type SubmitEvent } from 'react';

import {
    deleteCommunityPost,
    updateCommunityPost,
} from '../../api/communityPostApi';
import { COMMUNITY_LIMITS } from '../../constants/communityLimits';
import { useAlertStore } from '../../store/alertStore';
import { useUserStore } from '../../store/userStore';
import type { Post } from '../../types/post';
import { Button, Card, Field } from '../common';

interface CommunityPostActionsProps {
    post: Post;

    /*
     * 수정 성공 후 부모 목록의 게시글을 교체합니다.
     */
    onUpdated: (updatedPost: Post) => void;

    /*
     * 삭제 성공 후 부모 목록에서 게시글을 제거합니다.
     */
    onDeleted: (postId: number) => void;
}

export default function CommunityPostActions({
    post,
    onUpdated,
    onDeleted,
}: CommunityPostActionsProps) {
    const currentUser = useUserStore(
        (state) => state.currentUser
    );

    const showAlert = useAlertStore(
        (state) => state.showAlert
    );

    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(post.title);
    const [content, setContent] = useState(post.content);
    const [submitting, setSubmitting] = useState(false);

    /*
     * 화면에서는 작성자 이메일이 같은 경우에만 버튼을 표시합니다.
     *
     * 실제 보안 검사는 백엔드에서 JWT 사용자 ID로 다시 수행합니다.
     */
    const isOwner =
        currentUser.email.length > 0 &&
        currentUser.email.toLowerCase() ===
        post.writerEmail.toLowerCase();

    // currentUser.role은 Supabase app_metadata에서 확인된 역할만 사용합니다.
    const isAdmin = currentUser.role === 'ADMIN';
    const canDelete = isOwner || isAdmin;

    if (!isOwner && !isAdmin) {
        return null;
    }

    /*
     * 수정 모달을 열 때 현재 게시글 값을 다시 설정합니다.
     */
    const openEditModal = () => {
        setTitle(post.title);
        setContent(post.content);
        setEditing(true);
    };

    const closeEditModal = () => {
        if (submitting) {
            return;
        }

        setEditing(false);
    };

    /*
     * 제목과 내용만 수정 API로 전송합니다.
     */
    const handleUpdate = async (
        event: SubmitEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        if (!title.trim()) {
            showAlert('제목을 입력해 주세요.', 'error');
            return;
        }

        /*
         * 테스트 공유글만 빈 내용을 허용합니다.
         */
        if (
            post.category !== 'TEST_SHARE' &&
            !content.trim()
        ) {
            showAlert('내용을 입력해 주세요.', 'error');
            return;
        }

        try {
            setSubmitting(true);

            const updatedPost = await updateCommunityPost(
                post.id,
                {
                    title: title.trim(),
                    content: content.trim(),
                }
            );

            onUpdated(updatedPost);
            setEditing(false);

            showAlert(
                '게시글이 수정되었습니다.',
                'success'
            );
        } catch (error: unknown) {
            const message =
                error instanceof Error
                    ? error.message
                    : '게시글을 수정하지 못했습니다.';

            showAlert(message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    /*
     * 삭제 확인 후 게시글을 삭제합니다.
     */
    const handleDelete = async () => {
        const confirmed = window.confirm(
            '이 게시글을 삭제하시겠습니까?'
        );

        if (!confirmed) {
            return;
        }

        try {
            setSubmitting(true);

            await deleteCommunityPost(post.id);

            onDeleted(post.id);

            showAlert(
                '게시글이 삭제되었습니다.',
                'success'
            );
        } catch (error: unknown) {
            const message =
                error instanceof Error
                    ? error.message
                    : '게시글을 삭제하지 못했습니다.';

            showAlert(message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <div className="community-post-actions">
                {isOwner && (
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={submitting}
                        onClick={openEditModal}
                    >
                        수정
                    </Button>
                )}

                {canDelete && (
                    <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={submitting}
                        onClick={handleDelete}
                    >
                        삭제
                    </Button>
                )}
            </div>

            {editing && (
                /*
                 * 목록 위치와 관계없이 화면 중앙에서 수정할 수 있도록
                 * 모달 형태로 표시합니다.
                 */
                <div
                    role="presentation"
                    className="community-edit-dialog__backdrop"
                    onMouseDown={closeEditModal}
                >
                    <Card
                        as="section"
                        padding="lg"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={`post-edit-title-${post.id}`}
                        className="community-edit-dialog"
                        onMouseDown={(event) => {
                            /*
                             * 모달 내부 클릭으로 닫히는 것을 방지합니다.
                             */
                            event.stopPropagation();
                        }}
                        onKeyDown={(event) => {
                            // 키보드 사용자가 Esc로 수정 모달을 닫을 수 있게 합니다.
                            if (event.key === 'Escape' && !submitting) {
                                event.preventDefault();
                                closeEditModal();
                            }
                        }}
                    >
                        <h2 id={`post-edit-title-${post.id}`}>
                            게시글 수정
                        </h2>

                        <form className="community-edit-dialog__form" onSubmit={handleUpdate}>
                            <Field
                                label="제목"
                                htmlFor={`post-title-${post.id}`}
                                description={`${title.length} / ${COMMUNITY_LIMITS.POST_TITLE}자`}
                                required
                            >
                                <input
                                    id={`post-title-${post.id}`}
                                    className="fc-input"
                                    type="text"
                                    maxLength={COMMUNITY_LIMITS.POST_TITLE}
                                    value={title}
                                    onChange={(event) =>
                                        setTitle(event.target.value)
                                    }
                                    autoFocus
                                    required
                                />
                            </Field>

                            <Field
                                label={post.category === 'TEST_SHARE'
                                    ? '내용 (선택)'
                                    : '내용'}
                                htmlFor={`post-content-${post.id}`}
                                description={`${content.length} / ${COMMUNITY_LIMITS.POST_CONTENT.toLocaleString()}자`}
                                required={post.category !== 'TEST_SHARE'}
                            >
                                <textarea
                                    id={`post-content-${post.id}`}
                                    className="fc-input community-edit-dialog__textarea"
                                    rows={6}
                                    maxLength={COMMUNITY_LIMITS.POST_CONTENT}
                                    value={content}
                                    onChange={(event) =>
                                        setContent(event.target.value)
                                    }

                                    // 테스트 공유글은 소개글 없이 수정할 수 있습니다.
                                    required={post.category !== 'TEST_SHARE'}
                                />
                            </Field>

                            <div className="community-actions community-edit-dialog__actions">
                                <Button
                                    type="submit"
                                    isLoading={submitting}
                                    loadingText="수정 중..."
                                >
                                    수정 완료
                                </Button>

                                <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={submitting}
                                    onClick={closeEditModal}
                                >
                                    취소
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </>
    );
}
