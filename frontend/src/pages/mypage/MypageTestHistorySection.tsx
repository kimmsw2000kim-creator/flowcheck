import { useEffect, useState } from 'react';
import { Activity, Monitor } from 'lucide-react';

import { getAccessToken } from '../../api/authApi';
import { fetchMypageTestHistory } from '../../api/mypageApi';
import type { MypageTestHistoryItem } from '../../types/mypage';
import styles from '../../styles/mypage.module.css';

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

function MypageTestHistorySection() {
    const [tests, setTests] = useState<MypageTestHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const accessToken = getAccessToken();

        if (!accessToken) {
            setErrorMessage('로그인이 필요합니다.');
            setLoading(false);
            return;
        }

        fetchMypageTestHistory()
            .then(setTests)
            .catch((error) => {
                setErrorMessage(error.message || '테스트 이력을 불러오지 못했습니다.');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    return (
        <section className={styles['mypage-section']}>
            <h1>테스트 이력</h1>
            <p>실행한 테스트 목록과 결과 상태를 확인할 수 있습니다.</p>

            {loading && (
                <div className={styles['empty-state']}>
                    <strong>테스트 이력을 불러오는 중입니다.</strong>
                    <p>잠시만 기다려 주세요.</p>
                </div>
            )}

            {!loading && errorMessage && (
                <div className={styles['empty-state']}>
                    <strong>{errorMessage}</strong>
                    <p>로그인 상태를 확인한 뒤 다시 시도해 주세요.</p>
                </div>
            )}

            {!loading && !errorMessage && tests.length === 0 && (
                <div className={styles['empty-state']}>
                    <strong>실행한 테스트가 없습니다.</strong>
                    <p>AI UI 테스트나 부하 테스트를 실행하면 이곳에 기록됩니다.</p>
                </div>
            )}

            {!loading && !errorMessage && tests.length > 0 && (
                <div className={styles['test-history-list']}>
                    {tests.map((test) => {
                        const progress = test.progress ?? 0;
                        const isFailed = test.status === 'FAILED';
                        const isDone = test.status === 'COMPLETED';
                        const phase = test.phase ? phaseLabels[test.phase] || test.phase : null;

                        return (
                            <article className={styles['test-history-item']} key={`${test.testType}-${test.requestId}`}>
                                <div className={styles['test-history-icon']}>
                                    {test.testType === 'UI' ? <Monitor size={20} /> : <Activity size={20} />}
                                </div>

                                <div className={styles['test-history-main']}>
                                    <div className={styles['test-history-title-row']}>
                                        <div>
                                            <strong>{test.testName}</strong>
                                            <p>{test.targetUrl}</p>
                                        </div>

                                        <span className={`${styles['status-badge']} ${isDone ? '' : isFailed ? styles.failed : styles.pending}`}>
                                            {statusLabels[test.status] || test.status}
                                        </span>
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
