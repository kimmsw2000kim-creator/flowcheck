// 폼 제출 이벤트에는 FormEvent 대신 SubmitEvent를 사용합니다.
import { useState, type SubmitEvent } from 'react';

// 등록된 사이트 홍보 게시글 목록입니다.
import SitePromotionPostList from './SitePromotionPostList';

import { createCommunityPost } from '../../api/communityPostApi';
import { useDomains } from '../../hooks/useDomains';
import { useAlertStore } from '../../store/alertStore';
import EmptyState from '../common/EmptyState';

export default function SitePromotionTab() {
    /*
     * 로그인한 사용자가 등록한 사이트를 불러옵니다.
     */
    const { domains } = useDomains();

    const showAlert = useAlertStore((state) => state.showAlert);

    /*
     * 사이트 선택과 게시글 입력 상태입니다.
     */
    const [selectedDomainId, setSelectedDomainId] =
        useState<number | null>(null);

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    /*
 * 게시글 작성 성공 후 목록을 다시 불러오기 위한 값입니다.
 */
    const [refreshKey, setRefreshKey] = useState(0);

    /*
     * 소유권 인증이 완료된 사이트만 홍보 대상으로 표시합니다.
     */
    const verifiedDomains = domains.filter(
        (domain) => domain.verified
    );

    const selectedDomain = verifiedDomains.find(
        (domain) => domain.id === selectedDomainId
    );

    /*
     * 사이트 홍보 게시글을 실제 백엔드에 저장합니다.
     */
    const handleSubmit = async (
        event: SubmitEvent<HTMLFormElement>
    ) => {
        event.preventDefault();


        if (!selectedDomainId) {
            showAlert('홍보할 사이트를 선택해 주세요.', 'error');
            return;
        }

        if (!title.trim()) {
            showAlert('게시글 제목을 입력해 주세요.', 'error');
            return;
        }

        if (!content.trim()) {
            showAlert('사이트 소개 내용을 입력해 주세요.', 'error');
            return;
        }

        try {
            setSubmitting(true);

            await createCommunityPost({
                category: 'SITE_PROMOTION',
                title: title.trim(),
                content: content.trim(),
                siteId: selectedDomainId,
            });

            showAlert(
                '사이트 홍보 게시글이 등록되었습니다.',
                'success'
            );

            /*
             * 등록에 성공하면 입력값과 사이트 선택을 초기화합니다.
             */
            setSelectedDomainId(null);
            setTitle('');
            setContent('');
            // 새 게시글이 바로 목록에 표시되도록 다시 조회합니다.
            setRefreshKey((currentKey) => currentKey + 1);
        } catch (error: unknown) {
            const message =
                error instanceof Error
                    ? error.message
                    : '사이트 홍보 게시글을 등록하지 못했습니다.';

            showAlert(message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="card">
            <h2>내 사이트 홍보</h2>

            <p style={{ color: 'var(--text-secondary)' }}>
                소유권 인증이 완료된 사이트 중 홍보할 사이트를 선택해 주세요.
            </p>

            {verifiedDomains.length === 0 ? (
                <EmptyState
                    title="홍보할 수 있는 사이트가 없습니다."
                    description="사이트를 먼저 등록하고 소유권 인증을 완료해 주세요."
                />
            ) : (
                <>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns:
                                'repeat(auto-fit, minmax(260px, 1fr))',
                            gap: '1rem',
                            marginTop: '1.5rem',
                        }}
                    >
                        {verifiedDomains.map((domain) => {
                            const isSelected =
                                selectedDomainId === domain.id;

                            return (
                                <article
                                    key={domain.id}
                                    style={{
                                        padding: '1rem',
                                        border: isSelected
                                            ? '2px solid var(--accent)'
                                            : '1px solid var(--border)',
                                        borderRadius: '0.75rem',
                                        backgroundColor:
                                            'var(--bg-tertiary)',
                                    }}
                                >
                                    {/* 이름이 없으면 도메인 주소를 표시합니다. */}
                                    <h3 style={{ marginTop: 0 }}>
                                        {domain.serviceName ||
                                            domain.domainUrl}
                                    </h3>

                                    <p
                                        style={{
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        {domain.domainUrl}
                                    </p>

                                    <p style={{ color: 'var(--success)' }}>
                                        인증 완료
                                    </p>

                                    <button
                                        type="button"
                                        className={
                                            isSelected
                                                ? 'btn btn-primary'
                                                : 'btn btn-secondary'
                                        }
                                        aria-pressed={isSelected}
                                        onClick={() => {
                                            /*
                                             * 같은 사이트를 다시 누르면 선택을 해제합니다.
                                             */
                                            setSelectedDomainId(
                                                isSelected
                                                    ? null
                                                    : domain.id
                                            );
                                        }}
                                    >
                                        {isSelected
                                            ? '선택 해제'
                                            : '이 사이트 선택'}
                                    </button>
                                </article>
                            );
                        })}
                    </div>

                    {/* 사이트를 선택한 뒤에만 작성 폼을 표시합니다. */}
                    {selectedDomain && (
                        <form
                            onSubmit={handleSubmit}
                            style={{ marginTop: '2rem' }}
                        >
                            <h3>
                                선택한 사이트:{' '}
                                {selectedDomain.serviceName ||
                                    selectedDomain.domainUrl}
                            </h3>

                            <div className="form-group">
                                <label
                                    className="form-label"
                                    htmlFor="promotion-title"
                                >
                                    홍보글 제목
                                </label>

                                <input
                                    id="promotion-title"
                                    className="form-input"
                                    type="text"
                                    maxLength={100}
                                    value={title}
                                    onChange={(event) =>
                                        setTitle(event.target.value)
                                    }
                                    placeholder="사이트를 소개하는 제목을 입력해 주세요."
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label
                                    className="form-label"
                                    htmlFor="promotion-content"
                                >
                                    사이트 소개
                                </label>

                                <textarea
                                    id="promotion-content"
                                    className="form-input"
                                    rows={6}
                                    value={content}
                                    onChange={(event) =>
                                        setContent(event.target.value)
                                    }
                                    placeholder="사이트의 특징과 제공하는 기능을 작성해 주세요."
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={submitting}
                            >
                                {submitting
                                    ? '등록 중...'
                                    : '사이트 홍보글 등록'}
                            </button>
                        </form>
                    )}
                </>
            )}

            {/* 다른 사용자가 작성한 사이트 홍보 게시글도 함께 표시합니다. */}
            <SitePromotionPostList refreshKey={refreshKey} />
            
        </section>
    );
}