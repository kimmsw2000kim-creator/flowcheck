import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Monitor } from 'lucide-react';

import { fetchMypageTestHistory } from '../../api/mypageApi';
import type { MypageTestHistoryItem } from '../../types/mypage';
import styles from '../../styles/mypage.module.css';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import { supabase } from '../../lib/supabaseClient';

const statusLabels: Record<string, string> = {
    PENDING: '대기 중',
    RUNNING: '실행 중',
    COMPLETED: '완료',
    FAILED: '실패',
};

const phaseLabels: Record<string, string> = {
    QUEUED: '대기',
    PREPARING_REQUEST: '요청 준비',
    CALLING_FASTAPI: 'AI 서버 호출',
    PROCESSING_RESULTS: '결과 처리',
    SAVING_REPORT: '저장 중',
    COMPLETED: '완료',
    FAILED: '실패',
};

/*
 * 테스트 실행 시간을 한국 날짜 형식으로 변환합니다.
 */
function formatDate(value: string) {
    if (!value) {
        return '-';
    }

    return new Date(value).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

interface MypageTestHistorySectionProps {
    /*
     * 커뮤니티 화면에서 테스트 공유 버튼을 눌렀을 때 호출됩니다.
     *
     * 기존 마이페이지에서는 이 값을 전달하지 않기 때문에
     * 공유 버튼이 표시되지 않습니다.
     */
    onShare?: (test: MypageTestHistoryItem) => void;
}

function MypageTestHistorySection({
    onShare,
}: MypageTestHistorySectionProps) {
    const navigate = useNavigate();
    const [tests, setTests] = useState<MypageTestHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const checkAuthAndFetch = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError || !session) {
                    setErrorMessage('로그인이 필요합니다.');
                    setLoading(false);
                    return;
                }

                const data = await fetchMypageTestHistory();
                setTests(data);
            } catch (error: any) {
                setErrorMessage(error.message || '테스트 이력을 불러오지 못했습니다.');
            } finally {
                setLoading(false);
            }
        };

        checkAuthAndFetch();
    }, []);

    return (
        <section className={styles['mypage-section']}>
            <h1>테스트 이력</h1>
            <p>실행한 테스트 목록과 결과 상태를 확인할 수 있습니다.</p>

            {loading && (
                <EmptyState
                    title="테스트 이력을 불러오는 중입니다."
                    description="잠시만 기다려 주세요."
                />
            )}

            {!loading && errorMessage && (
                <EmptyState
                    title={errorMessage}
                    description="로그인 상태를 확인하고 다시 시도해 주세요."
                />
            )}

            {!loading && !errorMessage && tests.length === 0 && (
                <EmptyState
                    title="실행한 테스트가 없습니다."
                    description="AI UI/UX 테스트나 부하 테스트를 실행하면 이곳에 기록됩니다."
                />
            )}

            {!loading && !errorMessage && tests.length > 0 && (
                <div className={styles['test-history-list']}>
                    {tests.map((test) => {
                        const progress = test.progress ?? 0;
                        const phase = test.phase ? phaseLabels[test.phase] || test.phase : null;
                        const isUIUX = test.testType === 'UI' || test.testType === 'UIUX';

                        return (
                            <article
                                className={styles['test-history-item']}
                                key={`${test.testType}-${test.requestId}`}
                                style={{ cursor: 'pointer' }}
                                onClick={() => navigate(`/mypage/tests/${test.testType}/${test.requestId}`)}
                            >
                                <div className={styles['test-history-icon']}>
                                    {isUIUX ? <Monitor size={20} /> : <Activity size={20} />}
                                </div>

                                <div className={styles['test-history-main']}>
                                    <div className={styles['test-history-title-row']}>
                                        <div>
                                            <strong>{test.testName}</strong>
                                            <p>{test.targetUrl}</p>
                                        </div>

                                        <StatusBadge
                                            status={test.status}
                                            label={statusLabels[test.status] || test.status}
                                        />
                                    </div>

                                    <div className={styles['test-history-meta']}>
                                        <span>{formatDate(test.createdAt)}</span>
                                        {phase && <span>{phase}</span>}
                                        <span>진행률 {progress}%</span>
                                    </div>

                                    <div className={styles['test-history-progress']}>
                                        <div style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} />
                                    </div>

                                    {test.description && (
                                        <p className={styles['test-history-description']}>{test.description}</p>
                                    )}

                                    {/* 커뮤니티에서 사용하며 완료된 테스트에만 공유 버튼을 표시합니다. */}
                                    {onShare && test.status === 'COMPLETED' && (
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            style={{ marginTop: '1rem' }}
                                            onClick={(event) => {
                                                /*
                                                 * 부모 article의 상세 페이지 이동이 실행되지 않도록 막습니다.
                                                 */
                                                event.stopPropagation();
                                                onShare(test);
                                            }}
                                        >
                                            테스트 결과 공유
                                        </button>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

export default MypageTestHistorySection;
