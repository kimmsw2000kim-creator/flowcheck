import { RefreshCw } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { useLoadTest } from '../hooks/useLoadTest';

const phaseLabels: Record<string, string> = {
  QUEUED: '대기 중',
  DISPATCHED_TO_FASTAPI: 'FastAPI 전달 중',
  GENERATING_SCRIPT: 'k6 스크립트 생성 중',
  PROVISIONING_INFRA: '부하 테스트 인프라 실행 중',
  PREPARING_REQUEST: '요청 준비 중',
  CALLING_FASTAPI: 'FastAPI 호출 중',
  PROCESSING_RESULTS: '결과 처리 중',
  RESULT_READY: '결과 전달 준비 중',
  SAVING_REPORT: '리포트 저장 중',
  COMPLETED: '완료',
  FAILED: '실패',
};

export default function LoadPage() {
  const {
    currentUser,
    domains,
    selectedLoadDomain,
    setSelectedLoadDomain,
    vusers,
    setVusers,
    duration,
    setDuration,
    loadPrompt,
    setLoadPrompt,
    loadStatus,
    loadPhase,
    loadProgress,
    loadMessage,
    loadMetrics,
    loadChartData,
    runLoadTest,
  } = useLoadTest();

  return (
    <div style={{ textAlign: 'left' }}>
      <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>k6 지능형 부하 테스트 엔진</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '2rem' }}>
        <div>
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem' }}>부하 테스트 구성</h3>

            <div className="form-group">
              <label className="form-label">대상 웹사이트</label>
              <select
                className="form-input"
                value={selectedLoadDomain}
                onChange={(e) => setSelectedLoadDomain(parseInt(e.target.value))}
              >
                <option value="">-- 주소 선택하기 --</option>
                {domains.filter(d => d.verified).map(d => (
                  <option key={d.id} value={d.id}>{d.domainUrl}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">가상 동시 사용자 (VUsers): {vusers}명</label>
              <input
                type="range"
                min="10"
                max="2000"
                step="10"
                value={vusers}
                onChange={(e) => setVusers(parseInt(e.target.value))}
                style={{ accentColor: 'var(--accent)' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">테스트 실행 시간: {duration}초</label>
              <input
                type="range"
                min="10"
                max="120"
                step="10"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                style={{ accentColor: 'var(--accent)' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">시나리오 요구사항 (프롬프트 입력)</label>
              <textarea
                className="form-input"
                rows={3}
                value={loadPrompt.toString()}
                placeholder="테스트 시나리오에 대한 설명을 입력하세요..."
                onChange={(e) => setLoadPrompt(e.target.value)}
              ></textarea>
            </div>

            <div style={{
              background: 'var(--bg-tertiary)',
              border: `1.5px solid ${currentUser.loadTestCoupons > 0 ? 'var(--accent)' : currentUser.balance >= 10000 ? '#f59e0b' : '#ef4444'}`,
              borderRadius: '0.75rem',
              padding: '1rem 1.25rem',
              marginBottom: '1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>🎟️ 보유 현황</span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  background: currentUser.loadTestCoupons > 0 ? 'rgba(99,102,241,0.15)' : currentUser.balance >= 10000 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                  color: currentUser.loadTestCoupons > 0 ? 'var(--accent)' : currentUser.balance >= 10000 ? '#f59e0b' : '#ef4444',
                }}>
                  {currentUser.loadTestCoupons > 0 ? '쿠폰으로 차감' : currentUser.balance >= 10000 ? '크레딧으로 차감' : '잔액 부족'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '0.5rem', padding: '0.6rem 0.8rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>부하 테스트 쿠폰</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: currentUser.loadTestCoupons > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {currentUser.loadTestCoupons}회
                  </div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '0.5rem', padding: '0.6rem 0.8rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>크레딧 잔액</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: currentUser.balance >= 10000 ? 'var(--text-primary)' : '#ef4444' }}>
                    {currentUser.balance.toLocaleString()}P
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
                {currentUser.loadTestCoupons > 0
                  ? <>이번 테스트에 <strong style={{ color: 'var(--accent)' }}>부하 테스트 쿠폰 1회</strong>가 소모됩니다. (잔여 {currentUser.loadTestCoupons - 1}회)</>
                  : <>이번 테스트에 <strong style={{ color: '#f59e0b' }}>10,000 크레딧</strong>이 소모됩니다.</>
                }
              </div>
            </div>

            <Button
              variant="primary"
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={runLoadTest}
              isLoading={loadStatus === 'running'}
              loadingText="부하 테스트 실행 중..."
            >
              <span>테스트 시나리오 생성 및 실행</span>
            </Button>
          </div>
        </div>

        <div>
          <div className="card" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>테스트 분석 지표 및 실시간 차트</h3>

            {loadStatus === 'idle' && (
              <EmptyState
                title="부하 테스트 대기 중"
                description="Gemini AI가 k6 테스트 스크립트를 동적으로 설계하고 헤드리스로 구동합니다."
              />
            )}

            {loadStatus === 'running' && (
              <div style={{ textAlign: 'center', paddingTop: '5rem' }}>
                <RefreshCw className="animate-spin" size={40} style={{ margin: '0 auto 1.5rem', color: 'var(--accent)' }} />
                <p style={{ marginBottom: '1rem' }}>{loadMessage || 'Gemini AI가 k6 테스트 스크립트를 자동 작성하고 트래픽 시뮬레이션을 생성하는 중입니다...'}</p>
                <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span>{phaseLabels[loadPhase] || loadPhase || '작업 준비 중'}</span>
                    <span>{loadProgress}%</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '999px', backgroundColor: 'var(--bg-tertiary)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ width: `${loadProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--success))', transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              </div>
            )}

            {loadStatus === 'success' && loadMetrics && (
              <div>
                <div className={`report-markdown load-report-markdown grade-${loadMetrics.performanceGrade?.toLowerCase() ?? 'unknown'}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{loadMetrics.bottleneckComment}</ReactMarkdown>
                </div>

                {/* Line Chart */}
                <div style={{ height: '300px', width: '100%', marginTop: '2rem' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={loadChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="time" stroke="var(--text-muted)" />
                      <YAxis yAxisId="left" stroke="var(--accent)" />
                      <YAxis yAxisId="right" orientation="right" stroke="var(--success)" />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="avgResponse" name="평균 응답 시간 (ms)" stroke="var(--accent)" activeDot={{ r: 8 }} />
                      <Line yAxisId="right" type="monotone" dataKey="tps" name="초당 처리량 (TPS)" stroke="var(--success)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
