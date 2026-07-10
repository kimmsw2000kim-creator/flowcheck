import { useEffect, useState } from 'react';

import { fetchMypageCouponHistory } from '../../api/mypageApi';
import type { MypageCouponHistoryItem } from '../../types/mypage';
import styles from '../../styles/mypage.module.css';
import EmptyState from '../../components/common/EmptyState';
import { supabase } from '../../lib/supabaseClient';

const couponTypeLabels: Record<string, string> = {
    LOAD_TEST: '부하 테스트 쿠폰',
    UI_UX_TEST: 'UI/UX 테스트 쿠폰',
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

function MypageCouponHistorySection() {
    const [histories, setHistories] = useState<MypageCouponHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const checkAuthAndFetch = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                // 세션이 없거나 에러가 발생한 경우
                if (sessionError || !session) {
                    setErrorMessage('로그인이 필요합니다.');
                    setLoading(false);
                    return;
                }

                // 세션이 유효하면 API 호출 (인터셉터가 알아서 헤더에 토큰을 넣어줍니다)
                const data = await fetchMypageCouponHistory();
                setHistories(data);

            } catch (error: any) {
                setErrorMessage(error.message || '쿠폰 사용 내역을 불러오지 못했습니다.');
            } finally {
                setLoading(false);
            }
        };

        checkAuthAndFetch();
    }, []);

    return (
        <section className={styles['mypage-section']}>
            <h1>쿠폰 사용 내역</h1>
            <p>테스트 실행 시 사용한 쿠폰 내역을 확인할 수 있습니다.</p>

            {loading && (
                <EmptyState
                    title="쿠폰 사용 내역을 불러오는 중입니다."
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
                    title="쿠폰 사용 내역이 없습니다."
                    description="쿠폰으로 테스트를 실행하면 이곳에 기록됩니다."
                />
            )}

            {!loading && !errorMessage && histories.length > 0 && (
                <div className="coupon-history-list">
                    {histories.map((item) => (
                        <article className={styles['mypage-section-card']} key={item.logId}>
                            <div>
                                <strong>{couponTypeLabels[item.couponType] || item.couponType}</strong>
                                <p>{item.description}</p>
                                <p>{formatDate(item.usedAt)}</p>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}

export default MypageCouponHistorySection;
