import { useState, type SubmitEvent } from 'react';

import { createCommunityPost } from '../../api/communityPostApi';
import MypageTestHistorySection from '../../pages/mypage/MypageTestHistorySection';
import { useAlertStore } from '../../store/alertStore';
import type { MypageTestHistoryItem } from '../../types/mypage';
// 공유된 테스트 게시글 목록입니다.
import TestSharePostList from './TestSharePostList';

export default function TestHistoryTab() {
    const showAlert = useAlertStore((state) => state.showAlert);

    /*
     * 사용자가 공유 대상으로 선택한 완료 테스트입니다.
     */
    const [selectedTest, setSelectedTest] =
        useState<MypageTestHistoryItem | null>(null);

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    /*
 * 테스트 공유 성공 후 목록을 다시 불러오기 위한 값입니다.
 */
    const [refreshKey, setRefreshKey] = useState(0);
    /*
 * 테스트 공유 모달을 닫고 입력값을 초기화합니다.
 */
    const closeShareModal = () => {
        if (submitting) {
            return;
        }

        setSelectedTest(null);
        setTitle('');
        setContent('');
    };

    /*
     * 테스트 이력의 '결과 공유' 버튼을 누르면 호출됩니다.
     */
    const handleSelectTest = (
        test: MypageTestHistoryItem
    ) => {
        setSelectedTest(test);

        /*
         * 테스트 이름으로 기본 제목을 만들어주되
         * 사용자가 자유롭게 수정할 수 있습니다.
         */
        setTitle(`${test.testName} 결과 공유`);
        setContent('');
    };

    /*
     * 선택한 테스트 결과를 실제 커뮤니티 게시글로 등록합니다.
     */
    const handleSubmit = async (
        event: SubmitEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        if (!selectedTest) {
            showAlert('공유할 테스트를 선택해 주세요.', 'error');
            return;
        }

        if (!title.trim()) {
            showAlert('게시글 제목을 입력해 주세요.', 'error');
            return;
        }

        if (!content.trim()) {
            showAlert('테스트 결과 소개를 입력해 주세요.', 'error');
            return;
        }

        try {
            setSubmitting(true);

            await createCommunityPost({
                category: 'TEST_SHARE',
                title: title.trim(),
                content: content.trim(),
                testRequestId: selectedTest.requestId,
            });

            showAlert(
                '테스트 결과가 커뮤니티에 공유되었습니다.',
                'success'
            );

            /*
             * 등록 성공 후 선택과 작성 내용을 초기화합니다.
             */
            setSelectedTest(null);
            setTitle('');
            setContent('');

            // 실제 등록이 성공한 경우에만 게시글 목록을 다시 조회합니다.
            setRefreshKey((currentKey) => currentKey + 1);
        } catch (error: unknown) {
            const message =
                error instanceof Error
                    ? error.message
                    : '테스트 결과를 공유하지 못했습니다.';

            showAlert(message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            {/*
             * 기존 마이페이지 테스트 이력을 재사용하면서
             * 커뮤니티에서만 공유 버튼을 활성화합니다.
             */}
            <MypageTestHistorySection
                onShare={handleSelectTest}
            />

            {/* 완료된 테스트를 선택한 경우에만 작성 폼을 표시합니다. */}
            {selectedTest && (
                /*
                 * 테스트 이력이 많아도 현재 위치에서 바로 작성할 수 있도록
                 * 화면 중앙에 모달 형태로 표시합니다.
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
                        backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    }}
                    onMouseDown={closeShareModal}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="test-share-dialog-title"
                        className="card"
                        style={{
                            width: 'min(640px, 100%)',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            boxShadow: '0 24px 70px rgba(0, 0, 0, 0.3)',
                        }}
                        onMouseDown={(event) => {
                            /*
                             * 모달 내부를 클릭했을 때 닫히는 것을 방지합니다.
                             */
                            event.stopPropagation();
                        }}
                    >
                        <h2 id="test-share-dialog-title">
                            테스트 결과 공유
                        </h2>

                        <div
                            style={{
                                marginBottom: '1.5rem',
                                padding: '1rem',
                                border: '1px solid var(--border)',
                                borderRadius: '0.75rem',
                                backgroundColor: 'var(--bg-tertiary)',
                            }}
                        >
                            <strong>{selectedTest.testName}</strong>

                            <p
                                style={{
                                    marginBottom: 0,
                                    color: 'var(--text-secondary)',
                                    wordBreak: 'break-all',
                                }}
                            >
                                {selectedTest.targetUrl}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label
                                    className="form-label"
                                    htmlFor="test-share-title"
                                >
                                    공유글 제목
                                </label>

                                <input
                                    id="test-share-title"
                                    className="form-input"
                                    type="text"
                                    maxLength={100}
                                    value={title}
                                    onChange={(event) =>
                                        setTitle(event.target.value)
                                    }
                                    placeholder="테스트 결과를 소개하는 제목을 입력해 주세요."
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label
                                    className="form-label"
                                    htmlFor="test-share-content"
                                >
                                    테스트 결과 소개
                                </label>

                                <textarea
                                    id="test-share-content"
                                    className="form-input"
                                    rows={6}
                                    value={content}
                                    onChange={(event) =>
                                        setContent(event.target.value)
                                    }
                                    placeholder="테스트 목적, 주요 결과 또는 공유하고 싶은 정보를 작성해 주세요."
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
                                        ? '공유 중...'
                                        : '테스트 결과 공유'}
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    disabled={submitting}
                                    onClick={closeShareModal}
                                >
                                    취소
                                </button>

                                {/* 공유 및 취소 버튼 영역을 닫습니다. */}
                            </div>
                        </form>
                    </section>
                </div>
            )}

            {/* 다른 사용자가 공유한 테스트 결과도 함께 표시합니다. */}
            <TestSharePostList refreshKey={refreshKey} />

        </>
    );
}