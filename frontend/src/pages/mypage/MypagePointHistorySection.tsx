import { useEffect, useState } from 'react';

import { getAccessToken } from '../../api/authApi';
import { fetchMypagePointHistory } from '../../api/mypageApi';
import type { MypagePointHistoryItem } from '../../types/mypage';
import styles from '../../styles/mypage.module.css';
import EmptyState from '../../components/common/EmptyState';

const typeLabels: Record<string, string> = {
    CHARGE: '크레딧 충전',
    TEST_CONSUME: '테스트 차감',
    COUPON_BUY: '쿠폰 구매',
};

function formatDate(value: string) {
    return new Date(value).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function MypagePointHistorySection() {
    const [histories, setHistories] = useState<MypagePointHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const accessToken = getAccessToken();

        if (!accessToken) {
            setErrorMessage('로그인이 필요합니다.');
            setLoading(false);
            return;
        }

        fetchMypagePointHistory()
            .then(setHistories)
            .catch((error) => {
                setErrorMessage(error.message || '포인트 내역을 불러오지 못했습니다.');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    return (
        <section className={styles['mypage-section']}>
            <h1>포인트 내역</h1>
            <p>충전, 사용, 보상 지급 내역을 확인할 수 있습니다.</p>

            {loading && (
                <EmptyState
                    title="포인트 내역을 불러오는 중입니다."
                    description="잠시만 기다려 주세요."
                />
            )}

            {!loading && errorMessage && (
                <EmptyState
                    title={errorMessage}
                    description="로그인 상태를 확인한 뒤 다시 시도해 주세요."
                />
            )}

            {!loading && !errorMessage && histories.length === 0 && (
                <EmptyState
                    title="포인트 내역이 없습니다."
                    description="포인트 충전, 테스트 사용, 커뮤니티 보상 내역이 이곳에 표시됩니다."
                />
            )}

            {!loading && !errorMessage && histories.length > 0 && (
                <div className="point-history-list">
                    {histories.map((item) => (
                        <article className={styles['mypage-section-card']} key={item.ledgerId}>
                            <div>
                                <strong>{typeLabels[item.transactionType] || '기타'}</strong>
                                <p>{item.description}</p>
                                <p>{formatDate(item.createdAt)}</p>
                            </div>

                            <span style={{ color: item.amount >= 0 ? 'var(--success)' : 'var(--error)' }}>
                                {item.amount >= 0 ? '+' : ''}
                                {item.amount.toLocaleString()}P
                            </span>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}

export default MypagePointHistorySection;