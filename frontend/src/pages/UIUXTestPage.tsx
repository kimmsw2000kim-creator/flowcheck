import React, { useEffect, useRef, useState } from 'react';
import apiClient from '../api/client';
import ApiURL from '../api/ApiURL';
import {
  startUIUXTest,
  getUIUXTestStatus,
  issueUIUXVncAccess,
  cancelUIUXTest,
  reportUIUXClientLog,
  UIUXTestStepData,
  UIUXTestStatusResponse,
} from '../api/UIUXTestApi';
import { Badge } from '../components/common';
import type { BadgeTone } from '../components/common';
import UIUXResultView from '../components/uiux/UIUXResultView';
import { useUserStore } from '../store/userStore';
import { useAlertStore } from '../store/alertStore';
import { useDomains } from '../hooks/useDomains';

interface UIUXTestPageProps {
  selectedUIUXTestDomain: number;
  setSelectedUIUXTestDomain: (id: number) => void;
}

const formatStepNumber = (step: number) => String(step).padStart(2, '0');
const UIUX_POLL_INTERVAL_MS = 1000;
const UIUX_VNC_ACCESS_RETRY_MS = 2000;
const UIUX_MAX_VNC_ACCESS_RETRIES = 45;
const UIUX_VNC_ACCESS_LOG_EVERY = 5;
const UIUX_MAX_POLL_COUNT = 200;
const UIUX_MAX_POLL_ERRORS = 5;

const getLiveVncProxyOrigin = () => {
  // 로컬 Vite 개발 서버는 API 서버와 origin이 다르므로 백엔드 origin을 명시합니다.
  // 배포 환경에서는 ApiURL을 사용해 Spring의 VNC HTTP/WebSocket 프록시로 접근합니다.
  if (window.location.hostname === 'localhost' && window.location.port === '5173') {
    return 'http://localhost:8080';
  }

  if (window.location.hostname === '127.0.0.1' && window.location.port === '5173') {
    return 'http://127.0.0.1:8080';
  }

  return ApiURL;
};

const buildLiveVncProxyUrl = (url: string) => {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `${getLiveVncProxyOrigin()}${url}`;
};

const describeVncUrlForLog = (rawUrl: string) => {
  // 진단 로그에 token 전체를 남기지 않기 위해 URL의 origin/path/query key만 요약합니다.
  try {
    const parsed = new URL(rawUrl, window.location.origin);
    return {
      origin: parsed.origin,
      pathname: parsed.pathname,
      queryKeys: Array.from(parsed.searchParams.keys()).sort(),
    };
  } catch {
    return { malformed: true };
  }
};

const sendUIUXClientLog = (requestId: string | null, event: string, detail?: Record<string, unknown>) => {
  if (!requestId) return;
  void reportUIUXClientLog(requestId, event, {
    page: window.location.pathname,
    userAgent: navigator.userAgent,
    ...detail,
  }).catch(() => {});
};

type LiveStreamClientStatus = 'idle' | 'waiting' | 'ready' | 'connected' | 'error' | 'ended';

const getLiveStreamBadge = (
  testStatus: string,
  serverStatus: UIUXTestStatusResponse['liveStream'],
  clientStatus: LiveStreamClientStatus,
) => {
  if (clientStatus === 'connected') {
    return { label: '스트림 켜짐', tone: 'online' };
  }
  if (clientStatus === 'error' || serverStatus?.status === 'FAILED') {
    return { label: '스트림 오류', tone: 'error' };
  }
  if (clientStatus === 'ready' || serverStatus?.status === 'READY') {
    return { label: '스트림 연결 중', tone: 'ready' };
  }
  if (serverStatus?.status === 'WAITING' || clientStatus === 'waiting' || testStatus === 'running') {
    return { label: '스트림 준비 중', tone: 'waiting' };
  }
  if (serverStatus?.status === 'ENDED' || testStatus === 'success') {
    return { label: '스트림 종료', tone: 'ended' };
  }
  return { label: '스트림 대기', tone: 'idle' };
};

const getStepActionLabel = (action?: string) => {
  switch (action) {
    case 'PROVISIONING_VNC':
      return '클라우드 브라우저 준비 중';
    case 'STARTING_VNC':
    case 'STARTING_BROWSER':
      return '브라우저 준비';
    case 'LOAD_PAGE':
      return '페이지 로드';
    case 'CLASSIFY_SITE':
      return '사이트 유형 분류';
    case 'START_LIGHTHOUSE':
      return 'Lighthouse 측정 시작';
    case 'RUN_LIGHTHOUSE':
      return 'Lighthouse 측정';
    case 'START_AXE':
      return 'axe-core 검사 시작';
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
  const [liveVncProxyUrl, setLiveVncProxyUrl] = useState<string | null>(null);
  const [vncAccessRequestId, setVncAccessRequestId] = useState<string | null>(null);
  const [liveStreamServerStatus, setLiveStreamServerStatus] = useState<UIUXTestStatusResponse['liveStream']>();
  const [liveStreamClientStatus, setLiveStreamClientStatus] = useState<LiveStreamClientStatus>('idle');
  const [reportData, setReportData] = useState<UIUXTestStatusResponse | null>(null);
  const [isStopping, setIsStopping] = useState(false);

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

  const syncUserEntitlements = React.useCallback(async () => {
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
  }, [onUserUpdate]);

  useEffect(() => {
    const selected = domains.find((domain) => domain.id === selectedUIUXTestDomain);
    if (selected) {
      setTargetUrl(selected.domainUrl);
    }
  }, [selectedUIUXTestDomain, domains]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const isRunning = UIUXTestStatus === 'running';
  const hasUIUXCoupon = currentUser.UIUXTestCoupons > 0;
  const hasUIUXCredits = currentUser.balance >= 1000;
  const chargeTone: BadgeTone = hasUIUXCoupon ? 'info' : hasUIUXCredits ? 'warning' : 'danger';
  const liveStreamBadge = getLiveStreamBadge(UIUXTestStatus, liveStreamServerStatus, liveStreamClientStatus);
  const latestLiveFrame = [...UIUXTestSteps]
    .reverse()
    .find((step) => typeof step.screenshotUrl === 'string' && step.screenshotUrl.startsWith('data:image/'))
    ?.screenshotUrl;

  useEffect(() => {
    // 테스트가 RUNNING 상태가 되면 VNC signed URL을 별도로 요청합니다.
    // 컨테이너 시작과 noVNC 준비에는 시간이 걸릴 수 있으므로 2초 간격, 최대 45회까지만 재시도합니다.
    if (!isRunning || !currentRequestId) {
      return;
    }

    if (vncAccessRequestId === currentRequestId && liveVncProxyUrl) {
      return;
    }

    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;

    const requestVncAccess = () => {
      retryCount += 1;
      const shouldLogRetry = retryCount === 1 || retryCount % UIUX_VNC_ACCESS_LOG_EVERY === 0;
      if (shouldLogRetry) {
        sendUIUXClientLog(currentRequestId, 'vnc_token_request', { retryCount });
      }
      void issueUIUXVncAccess(currentRequestId)
        .then((response) => {
          if (disposed) return;
          if (!response.ready || !response.url) {
            setLiveStreamClientStatus('waiting');
            if (shouldLogRetry) {
              sendUIUXClientLog(currentRequestId, 'vnc_token_pending', {
                retryCount,
                message: response.message,
              });
            }
            if (retryCount >= UIUX_MAX_VNC_ACCESS_RETRIES) {
              console.warn('VNC access URL retry limit reached:', response.message);
              sendUIUXClientLog(currentRequestId, 'vnc_token_retry_limit', {
                retryCount,
                message: response.message,
              });
              return;
            }
            retryTimer = setTimeout(requestVncAccess, UIUX_VNC_ACCESS_RETRY_MS);
            return;
          }
          const proxyUrl = buildLiveVncProxyUrl(response.url);
          sendUIUXClientLog(currentRequestId, 'vnc_token_ready', {
            retryCount,
            expiresAt: response.expiresAt,
            proxyUrl: describeVncUrlForLog(proxyUrl),
          });
          setLiveStreamClientStatus('ready');
          setLiveVncProxyUrl(proxyUrl);
          setVncAccessRequestId(currentRequestId);
        })
        .catch((error) => {
          if (disposed) return;
          if (retryCount >= UIUX_MAX_VNC_ACCESS_RETRIES) {
            console.warn('VNC access URL retry limit reached:', error);
            sendUIUXClientLog(currentRequestId, 'vnc_token_retry_limit_error', {
              retryCount,
              message: error?.message,
              status: error?.response?.status,
              body: error?.response?.data,
            });
            return;
          }
          console.debug('VNC access URL is not ready yet:', error);
          setLiveStreamClientStatus('waiting');
          if (shouldLogRetry) {
            sendUIUXClientLog(currentRequestId, 'vnc_token_error_retrying', {
              retryCount,
              message: error?.message,
              status: error?.response?.status,
              body: error?.response?.data,
            });
          }
          retryTimer = setTimeout(requestVncAccess, UIUX_VNC_ACCESS_RETRY_MS);
        });
    };

    requestVncAccess();

    return () => {
      disposed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [currentRequestId, isRunning, liveVncProxyUrl, vncAccessRequestId]);

  const handleRunUIUXTest = async () => {
    // 테스트 시작 버튼의 메인 플로우입니다.
    // 1) 입력/잔액 검증 → 2) 시작 API 호출 → 3) requestId 저장 → 4) /status polling 시작 → 5) 완료 시 결과 표시 순서로 진행됩니다.
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
    setLiveVncProxyUrl(null);
    setVncAccessRequestId(null);
    setLiveStreamServerStatus(undefined);
    setLiveStreamClientStatus('waiting');
    setIsStopping(false);
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
        // requestId가 바뀌거나 사용자가 중지하면 이전 polling이 뒤늦게 상태를 덮어쓰지 않도록 activePollRequestIdRef로 보호합니다.
        if (activePollRequestIdRef.current !== requestId) return;
        pollTimeoutRef.current = setTimeout(pollStatus, UIUX_POLL_INTERVAL_MS);
      };

      const pollStatus = async () => {
        // Spring 백엔드가 저장한 rawLogs/report/defects를 주기적으로 가져옵니다.
        // 워커는 별도 컨테이너에서 돌기 때문에 프론트는 직접 워커와 통신하지 않고 항상 백엔드 상태만 읽습니다.
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
          setLiveStreamServerStatus(statusRes.liveStream);

          if (statusRes.status === 'COMPLETED') {
            // 완료 응답에는 점수, 마크다운 보고서, 결함 목록, 영상 URL이 포함됩니다.
            stopPolling();
            setUIUXTestStatus('success');
            setLiveStreamClientStatus('ended');
            setReportData(statusRes);
            void syncUserEntitlements();
            showAlert('AI UI/UX 테스트가 완료되었습니다.', 'success');
          } else if (statusRes.status === 'FAILED') {
            // 실패 상태도 최종 상태입니다. 일부 step/rawLogs가 남아 있을 수 있으므로 상태 조회는 여기서 멈춥니다.
            stopPolling();
            setUIUXTestStatus('error');
            setLiveStreamClientStatus('error');
            void syncUserEntitlements();
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
        // 시작 요청에서 쿠폰/크레딧이 차감될 수 있으므로 마이페이지 값을 다시 읽어 헤더/보유 현황을 동기화합니다.
        await syncUserEntitlements();
      } catch (err) {
        console.error('Failed to sync user state:', err);
      }
    } catch (err: any) {
      setUIUXTestStatus('error');
      setLiveStreamClientStatus('error');
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

  const handleStopUIUXTest = async () => {
    // 사용자가 중지를 누르면 백엔드 상태를 FAILED로 바꾸고 프론트 polling/VNC 연결 상태를 정리합니다.
    // 이미 완료된 테스트는 백엔드에서 거절될 수 있습니다.
    if (!currentRequestId || isStopping) {
      return;
    }

    setIsStopping(true);
    try {
      await cancelUIUXTest(currentRequestId);
      sendUIUXClientLog(currentRequestId, 'test_cancel_requested');
      stopPolling();
      setUIUXTestStatus('error');
      setLiveVncProxyUrl(null);
      setVncAccessRequestId(null);
      setLiveStreamClientStatus('ended');
      await syncUserEntitlements();
      showAlert('UI/UX 테스트를 중지했습니다. 결과는 실패 상태로 기록됩니다.', 'success');
    } catch (err: any) {
      const errorMessage =
        typeof err.response?.data === 'string'
          ? err.response.data
          : err.response?.data?.message || err.message || '테스트 중지에 실패했습니다.';
      showAlert(errorMessage, 'error');
    } finally {
      setIsStopping(false);
    }
  };

  const renderPlayerPlaceholder = (title: string, description: string) => (
    <div className="uiux-player-placeholder">
      <span className="uiux-loading-ring" />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
  return (
    <div className="uiux-page">
      <header className="uiux-header">
        <div>
          <h2>AI UI/UX 테스트</h2>
          <p>실시간 탐색 화면과 실행 로그를 확인하고, 완료 후 결과 영상과 결함 리포트를 제작합니다.</p>
        </div>
      </header>

      <section className="uiux-workbench">
        <aside className="uiux-card uiux-start-card">
          <div className="uiux-section-title">
            <span>테스트 시작</span>
            <small>{currentUser.UIUXTestCoupons > 0 ? '쿠폰 차감' : '크레딧 차감'}</small>
          </div>

          <div className="uiux-select-field">
            <div className="uiux-select-label-row">
              <label className="uiux-select-label" htmlFor="uiux-domain-select">인증 도메인</label>
              <span className="uiux-select-required">필수</span>
            </div>
            <div className="uiux-select-shell">
              <select
                id="uiux-domain-select"
                className="uiux-select-control"
                value={selectedUIUXTestDomain}
                onChange={(event) => setSelectedUIUXTestDomain(Number(event.target.value))}
                disabled={isRunning}
              >
                <option value="">도메인을 선택하세요</option>
                {domains.filter((domain) => domain.verified).map((domain) => (
                  <option key={domain.id} value={domain.id}>{domain.domainUrl}</option>
                ))}
              </select>
              <span className="uiux-select-chevron" aria-hidden="true" />
            </div>
            <p className="uiux-select-hint">검증이 완료된 도메인만 UI 테스트 대상으로 사용할 수 있습니다.</p>
          </div>

          <div className="uiux-select-field">
            <div className="uiux-select-label-row">
              <span className="uiux-select-label">테스트 대상 URL</span>
              <span className="uiux-select-required muted">자동 반영</span>
            </div>
            <div className="uiux-select-shell readonly">
              <div className={`uiux-selected-url ${targetUrl ? '' : 'empty'}`}>
                {targetUrl || '선택한 도메인 주소가 여기에 표시됩니다.'}
              </div>
            </div>
            <p className="uiux-select-hint">위에서 선택한 인증 도메인 주소가 테스트 대상으로 사용됩니다.</p>
          </div>

          <div className="uiux-charge-panel" data-tone={chargeTone}>
            <div className="uiux-charge-heading">
              <strong>보유 현황</strong>
              <Badge tone={chargeTone}>
                {hasUIUXCoupon ? '쿠폰으로 차감' : hasUIUXCredits ? '크레딧으로 차감' : '잔액 부족'}
              </Badge>
            </div>
            <div className="uiux-balance-panel">
              <div>
                <span>UI/UX 테스트 쿠폰</span>
                <strong>{currentUser.UIUXTestCoupons}회</strong>
              </div>
              <div>
                <span>크레딧 잔액</span>
                <strong data-insufficient={!hasUIUXCredits && !hasUIUXCoupon ? 'true' : undefined}>
                  {currentUser.balance.toLocaleString()}P
                </strong>
              </div>
            </div>
            <p className="uiux-charge-note">
              {hasUIUXCoupon
                ? `이번 테스트에 UI/UX 테스트 쿠폰 1회가 소모됩니다. 잔여 ${Math.max(currentUser.UIUXTestCoupons - 1, 0)}회`
                : '이번 테스트에 1,000 크레딧이 소모됩니다.'}
            </p>
          </div>

          <div className="uiux-action-row">
            <button className="uiux-primary-button" onClick={handleRunUIUXTest} disabled={isRunning || isStopping}>
              {isRunning ? (
                <span className="uiux-button-content">
                  <span>테스트 진행 중</span>
                  <span className="uiux-button-spinner" />
                </span>
              ) : (
                'UI 테스트 시작'
              )}
            </button>
            {isRunning && (
              <button
                className="uiux-stop-button"
                type="button"
                onClick={handleStopUIUXTest}
                disabled={isStopping}
              >
                {isStopping ? '중지 중' : '중지'}
              </button>
            )}
          </div>
        </aside>

        <main className="uiux-card uiux-live-card">
          <div className="uiux-card-header">
            <div>
              <span className="uiux-eyebrow">Live Stream</span>
              <h3>실시간 탐색 스트림</h3>
            </div>
            <span className={`uiux-status-pill uiux-status-${UIUXTestStatus}`}>
              {isRunning ? 'Running' : UIUXTestStatus === 'success' ? 'Completed' : UIUXTestStatus === 'error' ? 'Failed' : 'Ready'}
            </span>
          </div>

          <div className="uiux-youtube-frame uiux-live-frame">
            <div className={`uiux-live-stream-badge uiux-live-stream-badge-${liveStreamBadge.tone}`}>
              <span className="uiux-live-stream-dot" />
              {liveStreamBadge.label}
            </div>
            {isRunning && liveVncProxyUrl ? (
              <iframe
                key={liveVncProxyUrl}
                src={liveVncProxyUrl}
                title="Live Test Stream"
                allowFullScreen
                onLoad={() => {
                  setLiveStreamClientStatus('connected');
                  sendUIUXClientLog(currentRequestId, 'vnc_iframe_load', {
                    liveVncProxyUrl: describeVncUrlForLog(liveVncProxyUrl),
                  });
                }}
                onError={() => {
                  setLiveStreamClientStatus('error');
                  sendUIUXClientLog(currentRequestId, 'vnc_iframe_error', {
                    liveVncProxyUrl: describeVncUrlForLog(liveVncProxyUrl),
                  });
                }}
              />
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
        </main>

        <aside className="uiux-card uiux-log-card">
          <div className="uiux-card-header compact">
            <div>
              <span className="uiux-eyebrow">Steps</span>
              <h3>실행 로그</h3>
            </div>
          </div>

          <div className="uiux-step-list">
            {isRunning && UIUXTestSteps.length === 0 && (
              <div className="uiux-empty-steps">
                <span className="uiux-loading-ring small" />
                <p>초기화 중</p>
              </div>
            )}
            {UIUXTestSteps.map((step, index) => (
              <article className="uiux-step-item" key={`${step.step}-${index}`}>
                <div className="uiux-step-marker">
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
        </aside>
      </section>

      {UIUXTestStatus === 'success' && reportData && (
        <section className="uiux-results">
          <UIUXResultView result={reportData} />
        </section>
      )}
    </div>
  );
}
