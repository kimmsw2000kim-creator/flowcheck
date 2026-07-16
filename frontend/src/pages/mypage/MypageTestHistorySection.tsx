import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Monitor } from 'lucide-react';
import { fetchMypageTestHistory } from '../../api/mypageApi';
import type { MypageTestHistoryItem } from '../../types/mypage';
import { Badge, Button, Card, EmptyState, PageHeader } from '../../components/common';
import type { BadgeTone } from '../../components/common';
import { supabase } from '../../lib/supabaseClient';
import styles from '../../styles/mypage.module.css';

const TESTS_PER_PAGE = 5;
const statusLabels: Record<string, string> = { PENDING: '대기 중', RUNNING: '실행 중', COMPLETED: '완료', FAILED: '실패' };
const statusTones: Record<string, BadgeTone> = { PENDING: 'neutral', RUNNING: 'info', COMPLETED: 'success', FAILED: 'danger' };
const phaseLabels: Record<string, string> = { QUEUED: '대기', PREPARING_REQUEST: '요청 준비', CALLING_FASTAPI: 'AI 서버 호출', PROCESSING_RESULTS: '결과 처리', SAVING_REPORT: '저장 중', COMPLETED: '완료', FAILED: '실패' };
const formatDate = (value: string) => value ? new Date(value).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

const scoreItems = (test: MypageTestHistoryItem, progress: number): Array<[string, number | null | undefined]> => {
  if (test.testType === 'UI' || test.testType === 'UIUX') {
    const uiuxScores = [
      ['사용성', test.scoreUsability],
      ['접근성', test.scoreAccessibility],
      ['탐색', test.scoreEfficiency],
      ['성능', test.scorePerformance],
      ['품질', test.scoreBestPractices],
    ];
    return uiuxScores.some(([, value]) => value != null) ? uiuxScores : [['진행', progress]];
  }

  return [['성능', test.scorePerformance ?? test.overallScore ?? progress]];
};

interface MypageTestHistorySectionProps { onShare?: (test: MypageTestHistoryItem) => void; }

function MypageTestHistorySection({ onShare }: MypageTestHistorySectionProps) {
  const navigate = useNavigate();
  const [tests, setTests] = useState<MypageTestHistoryItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const totalPages = Math.ceil(tests.length / TESTS_PER_PAGE);
  const visibleTests = tests.slice((currentPage - 1) * TESTS_PER_PAGE, currentPage * TESTS_PER_PAGE);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) throw new Error('로그인이 필요합니다.');
        setTests(await fetchMypageTestHistory());
        setCurrentPage(1);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '테스트 이력을 불러오지 못했습니다.');
      } finally { setLoading(false); }
    };
    fetchHistory();
  }, []);

  return (
    <section className={styles['mypage-section']}>
      <PageHeader headingLevel={1} eyebrow="TEST HISTORY" title="테스트 이력" description="실행한 테스트 목록과 결과 상태를 확인할 수 있습니다." />
      {loading && <EmptyState title="테스트 이력을 불러오는 중입니다." description="잠시만 기다려 주세요." />}
      {!loading && errorMessage && <EmptyState title={errorMessage} description="로그인 상태를 확인하고 다시 시도해 주세요." />}
      {!loading && !errorMessage && tests.length === 0 && <EmptyState title="실행한 테스트가 없습니다." description="AI UI/UX 테스트나 부하 테스트를 실행하면 이곳에 기록됩니다." />}
      {!loading && !errorMessage && tests.length > 0 && (
        <div className={styles['test-history-list']}>
          {visibleTests.map((test) => {
            const progress = Math.min(Math.max(test.progress ?? 0, 0), 100);
            const phase = test.phase ? phaseLabels[test.phase] || test.phase : null;
            const isUIUX = test.testType === 'UI' || test.testType === 'UIUX';
            const detailPath = `/mypage/tests/${test.testType}/${test.requestId}`;
            const displayScore = test.overallScore ?? progress;
            return (
              <Card as="article" className={styles['test-history-item']} key={`${test.testType}-${test.requestId}`}>
                <div className={styles['test-history-icon']} aria-hidden="true">{isUIUX ? <Monitor size={20} /> : <Activity size={20} />}</div>
                <div className={styles['test-history-main']}>
                  <div className={styles['test-history-title-row']}>
                    <div><strong>{test.testName}</strong><p>{test.targetUrl}</p></div>
                    <Badge tone={statusTones[test.status] || 'neutral'}>{statusLabels[test.status] || test.status}</Badge>
                  </div>
                  <div className={styles['test-history-meta']}><span>{formatDate(test.createdAt)}</span>{phase && <span>{phase}</span>}<span>진행률 {progress}%</span></div>
                  <progress className={styles['test-history-progress']} max="100" value={progress} aria-label={`${test.testName} 진행률`}>{progress}%</progress>
                  {displayScore != null && (
                    <div className="uiux-history-score">
                      <div className="uiux-history-score__header">
                        <span>{test.overallScore != null ? '결과 점수' : '진행 그래프'}</span>
                        <strong>{displayScore}점</strong>
                      </div>
                      <div className="uiux-history-score__bars">
                        {scoreItems(test, progress)
                          .filter(([, value]) => value != null)
                          .map(([label, value]) => (
                            <div className="uiux-history-score__row" key={label}>
                              <span>{label}</span>
                              <div>
                                <i style={{ width: `${Math.min(Math.max(value ?? 0, 0), 100)}%` }} />
                              </div>
                              <strong>{value}점</strong>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  {test.description && <p className={styles['test-history-description']}>{test.description}</p>}
                  <div className={styles['test-history-actions']}>
                    <Button type="button" variant="secondary" size="sm" onClick={() => navigate(detailPath)}>상세 보기</Button>
                    {onShare && test.status === 'COMPLETED' && <Button type="button" variant="ghost" size="sm" onClick={() => onShare(test)}>테스트 결과 공유</Button>}
                  </div>
                </div>
              </Card>
            );
          })}
          {totalPages > 1 && (
            <nav aria-label="테스트 이력 페이지" className={styles.pagination}>
              <Button type="button" variant="secondary" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>이전</Button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <Button key={page} type="button" variant={currentPage === page ? 'primary' : 'secondary'} size="sm" aria-current={currentPage === page ? 'page' : undefined} onClick={() => setCurrentPage(page)}>{page}</Button>
              ))}
              <Button type="button" variant="secondary" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>다음</Button>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}

export default MypageTestHistorySection;
