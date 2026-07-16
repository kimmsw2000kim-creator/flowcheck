import { RefreshCw } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select } from '../components/common';
import type { BadgeTone } from '../components/common';
import { LoadTestResultView } from '../components/load';
import { useLoadTest } from '../hooks/useLoadTest';
import '../styles/LoadPage.css';

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

const statusPresentation: Record<string, { label: string; tone: BadgeTone }> = {
  idle: { label: 'Ready', tone: 'neutral' },
  running: { label: 'Running', tone: 'info' },
  success: { label: 'Completed', tone: 'success' },
  error: { label: 'Failed', tone: 'danger' },
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
    loadResult,
    runLoadTest,
  } = useLoadTest();

  const hasCoupon = currentUser.loadTestCoupons > 0;
  const hasCredits = currentUser.balance >= 10000;
  const chargeTone: BadgeTone = hasCoupon ? 'info' : hasCredits ? 'warning' : 'danger';
  const currentStatus = statusPresentation[loadStatus] || statusPresentation.idle;

  return (
    <div className="load-page">
      <PageHeader
        headingLevel={2}
        title="k6 지능형 부하 테스트 엔진"
        description="검증된 도메인에 실제 트래픽을 시뮬레이션하고 AI 성능 분석 결과를 확인합니다."
        actions={<Badge tone={currentStatus.tone}>{currentStatus.label}</Badge>}
      />

      <div className="load-page__workbench">
        <Card as="section" padding="md" className="load-page__configuration">
          <div className="load-page__section-heading">
            <span>Configuration</span>
            <h3>부하 테스트 구성</h3>
          </div>

          <Select
            id="load-domain"
            label="대상 웹사이트"
            description="소유권 검증이 완료된 도메인만 선택할 수 있습니다."
            value={selectedLoadDomain || ''}
            onChange={(event) => setSelectedLoadDomain(Number(event.target.value))}
            disabled={loadStatus === 'running'}
            required
          >
            <option value="">주소 선택하기</option>
            {domains.filter((domain) => domain.verified).map((domain) => (
              <option key={domain.id} value={domain.id}>{domain.domainUrl}</option>
            ))}
          </Select>

          <Field
            className="load-page__field"
            label={<span className="load-page__range-label">가상 동시 사용자 <output>{vusers}명</output></span>}
            htmlFor="load-vusers"
          >
            <input
              id="load-vusers"
              className="load-page__range"
              type="range"
              min="10"
              max="2000"
              step="10"
              value={vusers}
              onChange={(event) => setVusers(Number(event.target.value))}
              disabled={loadStatus === 'running'}
            />
          </Field>

          <Field
            className="load-page__field"
            label={<span className="load-page__range-label">테스트 실행 시간 <output>{duration}초</output></span>}
            htmlFor="load-duration"
          >
            <input
              id="load-duration"
              className="load-page__range"
              type="range"
              min="10"
              max="120"
              step="10"
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              disabled={loadStatus === 'running'}
            />
          </Field>

          <Field
            className="load-page__field"
            label="시나리오 요구사항"
            htmlFor="load-prompt"
            description="AI가 참고할 사용자 흐름이나 주요 API를 입력하세요."
          >
            <textarea
              id="load-prompt"
              className="load-page__textarea"
              rows={4}
              value={loadPrompt}
              placeholder="테스트 시나리오에 대한 설명을 입력하세요..."
              onChange={(event) => setLoadPrompt(event.target.value)}
              disabled={loadStatus === 'running'}
            />
          </Field>

          <div className="load-page__charge-panel" data-tone={chargeTone}>
            <div className="load-page__charge-heading">
              <strong>보유 현황</strong>
              <Badge tone={chargeTone}>
                {hasCoupon ? '쿠폰으로 차감' : hasCredits ? '크레딧으로 차감' : '잔액 부족'}
              </Badge>
            </div>
            <div className="load-page__balance-grid">
              <div>
                <span>부하 테스트 쿠폰</span>
                <strong>{currentUser.loadTestCoupons}회</strong>
              </div>
              <div>
                <span>크레딧 잔액</span>
                <strong data-insufficient={!hasCredits && !hasCoupon ? 'true' : undefined}>
                  {currentUser.balance.toLocaleString()}P
                </strong>
              </div>
            </div>
            <p>
              {hasCoupon
                ? `이번 테스트에 부하 테스트 쿠폰 1회가 소모됩니다. 잔여 ${currentUser.loadTestCoupons - 1}회`
                : '이번 테스트에 10,000 크레딧이 소모됩니다.'}
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={runLoadTest}
            isLoading={loadStatus === 'running'}
            loadingText="부하 테스트 실행 중..."
          >
            테스트 시나리오 생성 및 실행
          </Button>
        </Card>

        <section className="load-page__results" aria-label="부하 테스트 분석 결과">
          {loadStatus === 'success' && loadResult ? (
            <LoadTestResultView result={loadResult} />
          ) : (
            <Card padding="md" className="load-page__state-card">
              <div className="load-page__section-heading load-page__section-heading--row">
                <div>
                  <span>Live Analysis</span>
                  <h3>테스트 분석 지표 및 실시간 차트</h3>
                </div>
                <Badge tone={currentStatus.tone}>{currentStatus.label}</Badge>
              </div>

              {loadStatus === 'idle' && (
                <EmptyState
                  title="부하 테스트 대기 중"
                  description="Gemini AI가 k6 테스트 스크립트를 동적으로 설계하고 헤드리스로 구동합니다."
                />
              )}

              {loadStatus === 'running' && (
                <div className="load-page__running-state" role="status" aria-live="polite">
                  <RefreshCw className="load-page__spinner" size={40} aria-hidden="true" />
                  <strong>{loadMessage || '트래픽 시뮬레이션을 생성하는 중입니다...'}</strong>
                  <div className="load-page__progress-copy">
                    <span>{phaseLabels[loadPhase] || loadPhase || '작업 준비 중'}</span>
                    <span>{loadProgress}%</span>
                  </div>
                  <progress className="load-page__progress" value={loadProgress} max="100" aria-label="부하 테스트 진행률" />
                </div>
              )}

              {loadStatus === 'error' && (
                <EmptyState
                  title="부하 테스트를 완료하지 못했습니다."
                  description={loadMessage || '설정과 네트워크 상태를 확인한 후 다시 실행해 주세요.'}
                />
              )}
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
