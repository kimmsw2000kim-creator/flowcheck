import { useState, type SubmitEvent } from 'react';

import {
    deleteCommunityPost,
    updateCommunityPost,
} from '../../api/communityPostApi';
import { useAlertStore } from '../../store/alertStore';
import { useUserStore } from '../../store/userStore';
import type { Post } from '../../types/post';

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
    const currentUserEmail = useUserStore(
        (state) => state.currentUser.email
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
        currentUserEmail.length > 0 &&
        currentUserEmail.toLowerCase() ===
        post.writerEmail.toLowerCase();

    if (!isOwner) {
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

        if (!title.trim() || !content.trim()) {
            showAlert(
                '제목과 내용을 모두 입력해 주세요.',
                'error'
            );
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
            <div
                style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginTop: '1rem',
                }}
            >
                <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={submitting}
                    onClick={openEditModal}
                >
                    수정
                </button>

                <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={submitting}
                    style={{ color: 'var(--error)' }}
                    onClick={handleDelete}
                >
                    삭제
                </button>
            </div>

            {editing && (
                /*
                 * 목록 위치와 관계없이 화면 중앙에서 수정할 수 있도록
                 * 모달 형태로 표시합니다.
                 */
                <div
                    role="presentation"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1100,
                        display: 'grid',
                        placeItems: 'center',
                        padding: '1rem',
                        overflowY: 'auto',
                        backgroundColor:
                            'rgba(15, 23, 42, 0.65)',
                    }}
                    onMouseDown={closeEditModal}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={`post-edit-title-${post.id}`}
                        className="card"
                        style={{
                            width: 'min(640px, 100%)',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            boxShadow:
                                '0 24px 70px rgba(0, 0, 0, 0.3)',
                        }}
                        onMouseDown={(event) => {
                            /*
                             * 모달 내부 클릭으로 닫히는 것을 방지합니다.
                             */
                            event.stopPropagation();
                        }}
                    >
                        <h2 id={`post-edit-title-${post.id}`}>
                            게시글 수정
                        </h2>

                        <form onSubmit={handleUpdate}>
                            <div className="form-group">
                                <label
                                    className="form-label"
                                    htmlFor={`post-title-${post.id}`}
                                >
                                    제목
                                </label>

                                <input
                                    id={`post-title-${post.id}`}
                                    className="form-input"
                                    type="text"
                                    maxLength={100}
                                    value={title}
                                    onChange={(event) =>
                                        setTitle(event.target.value)
                                    }
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label
                                    className="form-label"
                                    htmlFor={`post-content-${post.id}`}
                                >
                                    내용
                                </label>

                                <textarea
                                    id={`post-content-${post.id}`}
                                    className="form-input"
                                    rows={6}
                                    value={content}
                                    onChange={(event) =>
                                        setContent(event.target.value)
                                    }
                                    required
                                />
                            </div>

                            <div
                                style={{
                                    display: 'flex',
                                    gap: '0.75rem',
                                }}
                            >
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={submitting}
                                >
                                    {submitting
                                        ? '수정 중...'
                                        : '수정 완료'}
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    disabled={submitting}
                                    onClick={closeEditModal}
                                >
                                    취소
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </>
    );
}