import React, { useEffect, useRef, useState } from 'react';
import apiClient from '../api/client';
import ApiURL from '../api/ApiURL';
import { startUIUXTest, getUIUXTestStatus, UIUXTestStepData, UIUXTestStatusResponse } from '../api/UIUXTestApi';
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select } from '../components/common';
import type { BadgeTone } from '../components/common';
import { UIUXResultView } from '../components/uiux';
import { useUserStore } from '../store/userStore';
import { useAlertStore } from '../store/alertStore';
import { useDomains } from '../hooks/useDomains';
import '../styles/UIUXTestPage.css';

interface UIUXTestPageProps {
  selectedUIUXTestDomain: number;
  setSelectedUIUXTestDomain: (id: number) => void;
}

const formatStepNumber = (step: number) => String(step).padStart(2, '0');
const UIUX_POLL_INTERVAL_MS = 3000;
const UIUX_MAX_POLL_COUNT = 200;
const UIUX_MAX_POLL_ERRORS = 5;

const getLiveVncProxyOrigin = () => {
  if (window.location.hostname === 'localhost' && window.location.port === '5173') {
    return 'http://localhost:8080';
  }

  if (window.location.hostname === '127.0.0.1' && window.location.port === '5173') {
    return 'http://127.0.0.1:8080';
  }

  return ApiURL;
};

const buildLiveVncProxyUrl = (requestId: string) => {
  const path = `/api/uiux-tests/${requestId}/vnc/vnc.html`;
  const websocketPath = `/api/uiux-tests/${requestId}/vnc/websockify`;
  return `${getLiveVncProxyOrigin()}${path}?autoconnect=true&resize=scale&path=${encodeURIComponent(websocketPath)}`;
};

const isLocalBrowser = () => ['localhost', '127.0.0.1'].includes(window.location.hostname);

const getDirectLocalVncUrl = (steps: UIUXTestStepData[]) => {
  if (!isLocalBrowser()) return null;

  const directUrl = [...steps]
    .reverse()
    .find((step) => typeof step.vncUrl === 'string' && step.vncUrl.length > 0)
    ?.vncUrl;

  if (!directUrl) return null;

  try {
    const parsed = new URL(directUrl);
    return ['localhost', '127.0.0.1'].includes(parsed.hostname) ? directUrl : null;
  } catch {
    return null;
  }
};

const getStepActionLabel = (action?: string) => {
  switch (action) {
    case 'STARTING_VNC':
    case 'STARTING_BROWSER':
      return '브라우저 준비';
    case 'LOAD_PAGE':
      return '페이지 로드';
    case 'RUN_LIGHTHOUSE':
      return 'Lighthouse 측정';
    case 'RUN_AXE':
      return 'axe-core 접근성 검사';
    case 'CHECK_DOM_RULES':
      return 'DOM 규칙 검사';
    case 'EXPLORE_PRIMARY_ACTION':
      return '주요 액션 검사';
    case 'CHECK_FORM_FEEDBACK':
      return '폼 피드백 검사';
    case 'CHECK_NAVIGATION':
      return '내비게이션 검사';
    case 'CALCULATE_SCORE':
      return '점수 산정';
    case 'SAVE_REPORT':
      return '보고서 저장';
    case 'FINISH':
      return '탐색 종료';
    default:
      return action || '실행 단계';
  }
};

export default function UIUXTestPage({
  selectedUIUXTestDomain,
  setSelectedUIUXTestDomain,
}: UIUXTestPageProps) {
  const currentUser = useUserStore((state) => state.currentUser);
  const onUserUpdate = useUserStore((state) => state.updateUserBalanceAndCoupons);
  const showAlert = useAlertStore((state) => state.showAlert);
  const { domains } = useDomains();

  const [targetUrl, setTargetUrl] = useState('');
  const [UIUXTestStatus, setUIUXTestStatus] = useState('idle');
  const [UIUXTestSteps, setUIUXTestSteps] = useState<UIUXTestStepData[]>([]);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<UIUXTestStatusResponse | null>(null);

  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollErrorCountRef = useRef(0);
  const pollCountRef = useRef(0);
  const activePollRequestIdRef = useRef<string | null>(null);
  const isSubmittingRef = useRef(false);

  const stopPolling = React.useCallback(() => {
    activePollRequestIdRef.current = null;
    if (pollTimeoutRef.current !== null) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const selected = domains.find((domain) => domain.id === selectedUIUXTestDomain);
    if (selected) {
      setTargetUrl(selected.domainUrl);
    }
  }, [selectedUIUXTestDomain, domains]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const isRunning = UIUXTestStatus === 'running';
  const hasLiveVncUrl = UIUXTestSteps.some((step) => typeof step.vncUrl === 'string' && step.vncUrl.length > 0);
  const directLocalVncUrl = getDirectLocalVncUrl(UIUXTestSteps);
  const liveVncProxyUrl = directLocalVncUrl || (currentRequestId && hasLiveVncUrl ? buildLiveVncProxyUrl(currentRequestId) : null);
  const latestLiveFrame = [...UIUXTestSteps]
    .reverse()
    .find((step) => typeof step.screenshotUrl === 'string' && step.screenshotUrl.startsWith('data:image/'))
    ?.screenshotUrl;
  const statusPresentation: Record<string, { label: string; tone: BadgeTone }> = {
    idle: { label: 'Ready', tone: 'neutral' },
    running: { label: 'Running', tone: 'info' },
    success: { label: 'Completed', tone: 'success' },
    error: { label: 'Failed', tone: 'danger' },
  };
  const currentStatus = statusPresentation[UIUXTestStatus] || statusPresentation.idle;

  const handleRunUIUXTest = async () => {
    if (isSubmittingRef.current) {
      showAlert('이미 테스트 요청을 처리 중입니다. 잠시만 기다려 주세요.', 'error');
      return;
    }

    if (isRunning) {
      showAlert('테스트가 이미 실행 중입니다.', 'error');
      return;
    }

    if (!targetUrl.trim()) {
      showAlert('테스트할 URL을 입력해 주세요.', 'error');
      return;
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      showAlert('URL은 http:// 또는 https://로 시작해야 합니다.', 'error');
      return;
    }

    if (currentUser.UIUXTestCoupons <= 0 && currentUser.balance < 1000) {
      showAlert('UI/UX 테스트 쿠폰 또는 크레딧 잔액이 부족합니다.', 'error');
      return;
    }

    setUIUXTestStatus('running');
    setUIUXTestSteps([]);
    setReportData(null);
    setCurrentRequestId(null);
    isSubmittingRef.current = true;

    try {
      const startRes = await startUIUXTest(targetUrl);
      const requestId = startRes.requestId;
      setCurrentRequestId(requestId);

      showAlert('AI UI/UX 테스트 에이전트가 시작되었습니다.', 'success');

      stopPolling();
      pollErrorCountRef.current = 0;
      pollCountRef.current = 0;
      activePollRequestIdRef.current = requestId;

      const scheduleNextPoll = () => {
        if (activePollRequestIdRef.current !== requestId) return;
        pollTimeoutRef.current = setTimeout(pollStatus, UIUX_POLL_INTERVAL_MS);
      };

      const pollStatus = async () => {
        if (activePollRequestIdRef.current !== requestId) return;
        pollCountRef.current += 1;

        if (pollCountRef.current > UIUX_MAX_POLL_COUNT) {
          stopPolling();
          setUIUXTestStatus('error');
          showAlert('테스트 응답 대기 시간이 초과되었습니다.', 'error');
          return;
        }

        try {
          const statusRes = await getUIUXTestStatus(requestId);
          if (activePollRequestIdRef.current !== requestId) return;

          pollErrorCountRef.current = 0;
          setUIUXTestSteps(statusRes.steps || []);

          if (statusRes.status === 'COMPLETED') {
            stopPolling();
            setUIUXTestStatus('success');
            setReportData(statusRes);
            showAlert('AI UI/UX 테스트가 완료되었습니다.', 'success');
          } else if (statusRes.status === 'FAILED') {
            stopPolling();
            setUIUXTestStatus('error');
            showAlert('AI UI/UX 테스트 중 오류가 발생했습니다.', 'error');
          } else {
            scheduleNextPoll();
          }
        } catch {
          if (activePollRequestIdRef.current !== requestId) return;

          pollErrorCountRef.current += 1;
          if (pollErrorCountRef.current >= UIUX_MAX_POLL_ERRORS) {
            stopPolling();
            setUIUXTestStatus('error');
            showAlert('상태 조회가 중단되었습니다.', 'error');
          } else {
            scheduleNextPoll();
          }
        }
      };

      pollStatus();

      try {
        const mypageRes = await apiClient.get('/api/mypage');
        onUserUpdate({
          balance: mypageRes.data.balance,
          coupons: mypageRes.data.couponCount,
          loadTestCoupons: mypageRes.data.loadTestCouponCount,
          UIUXTestCoupons: mypageRes.data.UIUXTestCouponCount,
        });
      } catch (err) {
        console.error('Failed to sync user state:', err);
      }
    } catch (err: any) {
      setUIUXTestStatus('error');
      let errorMessage = 'AI 서버를 호출하지 못했습니다.';
      if (err.response?.data) {
        errorMessage = typeof err.response.data === 'string' ? err.response.data : err.response.data.message || errorMessage;
      } else if (err.message) {
        errorMessage = err.message;
      }
      showAlert(errorMessage, 'error');
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const renderPlayerPlaceholder = (title: string, description: string) => (
    <div className="uiux-player-placeholder">
      <span className="uiux-loading-ring" aria-hidden="true" />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );

  return (
    <div className="uiux-page">
      <PageHeader
        headingLevel={2}
        title="AI UI/UX 테스트"
        description="실시간 탐색 화면과 실행 로그를 확인하고, 완료 후 결과 영상과 결함 리포트를 제작합니다."
      />

      <section className="uiux-workbench">
        <Card as="aside" padding="md" className="uiux-start-card">
          <div className="uiux-section-title">
            <span>테스트 시작</span>
            <small>{currentUser.UIUXTestCoupons > 0 ? '쿠폰 차감' : '크레딧 차감'}</small>
          </div>

          <Select
            id="uiux-domain-select"
            containerClassName="uiux-start-field"
            label="인증 도메인"
            description="검증이 완료된 도메인만 UI 테스트 대상으로 사용할 수 있습니다."
            value={selectedUIUXTestDomain}
            onChange={(event) => setSelectedUIUXTestDomain(Number(event.target.value))}
            disabled={isRunning}
            required
          >
            <option value="">도메인을 선택하세요</option>
            {domains.filter((domain) => domain.verified).map((domain) => (
              <option key={domain.id} value={domain.id}>{domain.domainUrl}</option>
            ))}
          </Select>

          <Field
            className="uiux-start-field uiux-readonly-field"
            label={(
              <span className="uiux-readonly-label">
                테스트 대상 URL
                <Badge tone="neutral">자동 반영</Badge>
              </span>
            )}
            htmlFor="uiux-target-url"
            description="위에서 선택한 인증 도메인 주소가 테스트 대상으로 사용됩니다."
          >
            <output
              id="uiux-target-url"
              className="uiux-selected-url"
              data-empty={targetUrl ? undefined : 'true'}
            >
              {targetUrl || '선택한 도메인 주소가 여기에 표시됩니다.'}
            </output>
          </Field>

          <div className="uiux-balance-panel">
            <div>
              <span>테스트 쿠폰</span>
              <strong>{currentUser.UIUXTestCoupons}개 보유</strong>
            </div>
            <div>
              <span>크레딧 잔액</span>
              <strong>{currentUser.balance.toLocaleString()}P</strong>
            </div>
          </div>

          <p className="uiux-charge-note">
            {currentUser.UIUXTestCoupons > 0
              ? `이번 테스트에 쿠폰 1개가 사용됩니다. 사용 후 ${Math.max(currentUser.UIUXTestCoupons - 1, 0)}개 보유`
              : '이번 테스트에 1,000 크레딧이 소모됩니다.'}
          </p>

          <Button
            size="lg"
            fullWidth
            isLoading={isRunning}
            loadingText="테스트 진행 중"
            onClick={handleRunUIUXTest}
          >
            UI 테스트 시작
          </Button>
        </Card>

        <Card as="section" padding="none" className="uiux-live-card">
          <div className="uiux-card-header">
            <div>
              <span className="uiux-eyebrow">Live Stream</span>
              <h3>실시간 탐색 스트림</h3>
            </div>
            <Badge tone={currentStatus.tone} role="status" aria-live="polite">{currentStatus.label}</Badge>
          </div>

          <div className="uiux-youtube-frame uiux-live-frame">
            {isRunning && liveVncProxyUrl ? (
              <iframe key={liveVncProxyUrl} src={liveVncProxyUrl} title="Live Test Stream" allowFullScreen />
            ) : latestLiveFrame ? (
              <img className="uiux-live-screenshot" src={latestLiveFrame} alt="Live UI exploration frame" />
            ) : isRunning ? (
              renderPlayerPlaceholder('실시간 영상 준비 중', '브라우저 컨테이너가 시작되면 VNC 영상 스트림이 자동으로 연결됩니다.')
            ) : (
              <div className="uiux-player-idle">
                <strong>대기 중</strong>
                <p>테스트를 시작하면 이 영역에 실시간 탐색 화면이 표시됩니다.</p>
              </div>
            )}
          </div>
        </Card>

        <Card as="aside" padding="sm" className="uiux-log-card">
          <div className="uiux-card-header compact">
            <div>
              <span className="uiux-eyebrow">Steps</span>
              <h3>실행 로그</h3>
            </div>
          </div>

          <div className="uiux-step-list" aria-live="polite">
            {UIUXTestSteps.length === 0 && (
              <EmptyState
                className="uiux-log-empty"
                icon={isRunning ? <span className="uiux-loading-ring small" aria-hidden="true" /> : undefined}
                title={isRunning ? '초기화 중' : '실행 로그가 없습니다.'}
                description={isRunning ? '첫 번째 탐색 단계를 기다리고 있습니다.' : '테스트를 시작하면 단계별 로그가 표시됩니다.'}
              />
            )}
            {UIUXTestSteps.map((step, index) => (
              <article className="uiux-step-item" key={`${step.step}-${index}`}>
                <div className="uiux-step-marker" aria-hidden="true">
                  <span className="uiux-step-dot" />
                  <span className="uiux-step-line" />
                </div>
                <div className="uiux-step-content">
                  <div className="uiux-step-meta">STEP {formatStepNumber(index + 1)}</div>
                  <strong>{getStepActionLabel(step.action)}</strong>
                  <p>{step.reason || step.url || '탐색 단계가 기록되었습니다.'}</p>
                </div>
              </article>
            ))}
          </div>
        </Card>
      </section>

      {UIUXTestStatus === 'success' && reportData && <UIUXResultView result={reportData} />}
    </div>
  );
}
