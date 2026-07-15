import React, { useEffect, useRef, useState } from 'react';
import apiClient from '../api/client';
import ApiURL from '../api/ApiURL';
import { startUIUXTest, getUIUXTestStatus, UIUXTestStepData, UIUXTestStatusResponse } from '../api/UIUXTestApi';
import CustomVideoPlayer from '../components/video/CustomVideoPlayer';
import UIUXScoreRadarChart from '../components/dashboard/UIUXScoreRadarChart';
import UIUXScoreBarChart from '../components/dashboard/UIUXScoreBarChart';
import { useUserStore } from '../store/userStore';
import { useAlertStore } from '../store/alertStore';
import { useDomains } from '../hooks/useDomains';
import '../styles/UIUXTestPage.css';

interface UIUXTestPageProps {
  selectedUIUXTestDomain: number;
  setSelectedUIUXTestDomain: (id: number) => void;
  onAddLedger: (ledgerItem: any) => void;
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

const formatTimeForDisplay = (time: number) => {
  if (Number.isNaN(time)) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const parseReportCards = (report?: string) => {
  const lines = report
    ?.split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines?.length) return [];

  const cards: Array<{ id: string; title: string; items: string[] }> = [];
  let currentCard: { id: string; title: string; items: string[] } | null = null;

  lines.forEach((line) => {
    const isHeading = line.startsWith('#');
    const normalized = line
      .replace(/^#{1,6}\s*/, '')
      .replace(/^[-*]\s*/, '')
      .replace(/\*\*/g, '')
      .trim();

    if (!normalized) return;

    if (isHeading) {
      currentCard = {
        id: `${cards.length}-${normalized.slice(0, 20)}`,
        title: normalized,
        items: [],
      };
      cards.push(currentCard);
      return;
    }

    if (!currentCard) {
      currentCard = {
        id: `${cards.length}-summary`,
        title: '진단 요약',
        items: [],
      };
      cards.push(currentCard);
    }

    currentCard.items.push(normalized);
  });

  return cards.map((card) => ({
    ...card,
    items: card.items.length ? card.items : ['이번 테스트에서 추가 설명이 감지되지 않았습니다.'],
  }));
};

const getEngineLabel = (source?: string) => {
  switch (source) {
    case 'LIGHTHOUSE':
      return 'Lighthouse';
    case 'AXE':
      return 'axe-core';
    case 'PLAYWRIGHT':
      return 'Playwright';
    case 'UX_RULE':
      return 'UX Rule';
    default:
      return 'Rule';
  }
};

const getScoreGrade = (score?: number) => {
  if (score == null) return '대기';
  if (score >= 90) return '우수';
  if (score >= 75) return '양호';
  if (score >= 60) return '개선 필요';
  return '위험';
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

const getEngineSummary = (scoreBreakdown?: Record<string, unknown>) => {
  const engineResults = scoreBreakdown?.engineResults as Record<string, any> | undefined;
  const lighthouse = engineResults?.lighthouse;
  const axe = engineResults?.axe;

  return [
    {
      label: 'Lighthouse',
      value: lighthouse?.available ? '정상' : '대체 규칙',
      detail: lighthouse?.available ? '성능, 접근성, 기술 품질 점수를 반영했습니다.' : lighthouse?.error || '실행 결과가 없습니다.',
    },
    {
      label: 'axe-core',
      value: axe?.available ? '정상' : '대체 규칙',
      detail: axe?.available ? `${axe?.violationCount ?? 0}개 접근성 위반을 분석했습니다.` : axe?.error || '실행 결과가 없습니다.',
    },
  ];
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
  const [activeDefectId, setActiveDefectId] = useState<number | null>(null);
  const [showHeuristics, setShowHeuristics] = useState(false);

  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollErrorCountRef = useRef(0);
  const pollCountRef = useRef(0);
  const activePollRequestIdRef = useRef<string | null>(null);
  const isSubmittingRef = useRef(false);
  const customVideoRef = useRef<any>(null);

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
  const reportCards = parseReportCards(reportData?.report);
  const overallScore = reportData?.scores?.overall;
  const engineSummary = getEngineSummary(reportData?.scoreBreakdown);
  const latestLiveFrame = [...UIUXTestSteps]
    .reverse()
    .find((step) => typeof step.screenshotUrl === 'string' && step.screenshotUrl.startsWith('data:image/'))
    ?.screenshotUrl;

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

      scheduleNextPoll();
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

  const handleVideoTimeUpdate = (currentTime: number) => {
    if (!reportData?.defects) return;
    const currentDefect = reportData.defects.find((defect) => Math.abs(defect.timestampOffset - currentTime) < 1);
    setActiveDefectId(currentDefect?.id || null);
  };

  const handleDefectClick = (offset: number) => {
    setActiveDefectId(reportData?.defects?.find((defect) => defect.timestampOffset === offset)?.id || null);
    customVideoRef.current?.seekTo(offset);
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

          <button className="uiux-primary-button" onClick={handleRunUIUXTest} disabled={isRunning}>
            {isRunning ? (
              <span className="uiux-button-content">
                <span>테스트 진행 중</span>
                <span className="uiux-button-spinner" />
              </span>
            ) : (
              'UI 테스트 시작'
            )}
          </button>
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
          {reportData.scores && (
            <div className="uiux-summary-grid">
              <div className="uiux-card uiux-overall-card">
                <span className="uiux-eyebrow">Overall</span>
                <div>
                  <strong>{overallScore ?? '-'}</strong>
                  <span>점</span>
                </div>
                <p>{getScoreGrade(overallScore)} · Lighthouse, axe-core, Playwright 결과를 종합했습니다.</p>
              </div>

              <div className="uiux-card uiux-engine-card">
                <span className="uiux-eyebrow">Evaluation Engines</span>
                <div className="uiux-engine-list">
                  {engineSummary.map((engine) => (
                    <div className="uiux-engine-item" key={engine.label}>
                      <div>
                        <strong>{engine.label}</strong>
                        <p>{engine.detail}</p>
                      </div>
                      <span>{engine.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {reportData.scores && (
            <div className="uiux-score-grid">
              <div className="uiux-card uiux-chart-card">
                <UIUXScoreRadarChart scores={reportData.scores} />
              </div>
              <div className="uiux-card uiux-chart-card">
                <UIUXScoreBarChart scores={reportData.scores} />
              </div>
            </div>
          )}

          <div className="uiux-report-grid">
            <div className="uiux-card uiux-report-video-card">
              <div className="uiux-video-titlebar">
                <div>
                  <span className="uiux-eyebrow">Playback</span>
                  <h3>최종 결과 비디오</h3>
                </div>
              </div>
              <div className="uiux-youtube-frame">
                {reportData.videoUrl ? (
                  <CustomVideoPlayer
                    ref={customVideoRef}
                    src={reportData.videoUrl}
                    defects={reportData.defects}
                    activeDefectId={activeDefectId}
                    onTimeUpdate={handleVideoTimeUpdate}
                    onDefectClick={(offset) => {
                      setActiveDefectId(reportData.defects?.find((defect) => defect.timestampOffset === offset)?.id || null);
                      customVideoRef.current?.seekTo(offset);
                    }}
                  />
                ) : (
                  <div className="uiux-player-idle">
                    <strong>비디오 기록 없음</strong>
                    <p>테스트가 완료되면 녹화 영상이 표시됩니다.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="uiux-card uiux-defect-card">
              <div className="uiux-card-header compact">
                <div>
                  <span className="uiux-eyebrow">Issues</span>
                  <h3>결함 타임라인</h3>
                </div>
              </div>

              <div className="uiux-defect-list">
                {reportData.defects && reportData.defects.length > 0 ? (
                  reportData.defects.map((defect) => (
                    <button
                      type="button"
                      key={defect.id}
                      className={`uiux-defect-item ${activeDefectId === defect.id ? 'active' : ''}`}
                      onClick={() => handleDefectClick(defect.timestampOffset)}
                    >
                      <div>
                        <span>{getEngineLabel(defect.source)}</span>
                        <strong>{defect.category}</strong>
                      </div>
                      <div className="uiux-defect-meta">
                        <span>{defect.severity}</span>
                        {defect.ruleId && <span>{defect.ruleId}</span>}
                      </div>
                      <p>{defect.description}</p>
                      {defect.recommendation && <em>{defect.recommendation}</em>}
                      <small>{formatTimeForDisplay(defect.timestampOffset)}</small>
                    </button>
                  ))
                ) : (
                  <div className="uiux-empty-steps">
                    <p>발견된 결함이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="uiux-card uiux-report-card">
            <button className="uiux-report-toggle" type="button" onClick={() => setShowHeuristics(!showHeuristics)}>
              <span>상세 보고서</span>
              <small>{showHeuristics ? '접기' : '펼치기'}</small>
            </button>

            {showHeuristics && (
              <div className="uiux-report-details">
                {reportData.scoreBreakdown && (
                  <article className="uiux-report-detail-card">
                    <div className="uiux-report-detail-index">EV</div>
                    <div>
                      <strong>평가 기준 버전 {reportData.evaluationVersion || 'v1'}</strong>
                      <p>사용성 25%, 접근성 25%, 성능 20%, 탐색 효율 15%, 기술 품질 15% 가중치로 종합 점수를 산정했습니다.</p>
                    </div>
                  </article>
                )}
                <article className="uiux-report-detail-card">
                  <div className="uiux-report-detail-index">EN</div>
                  <div>
                    <strong>검사 엔진 상태</strong>
                    <ul className="uiux-report-detail-list">
                      {engineSummary.map((engine) => (
                        <li key={`engine-${engine.label}`}>{engine.label} {engine.value}: {engine.detail}</li>
                      ))}
                    </ul>
                  </div>
                </article>
                {reportCards.length > 0 ? (
                  reportCards.map((card, index) => (
                    <article className="uiux-report-detail-card" key={card.id}>
                      <div className="uiux-report-detail-index">{formatStepNumber(index + 1)}</div>
                      <div>
                        <strong>{card.title}</strong>
                        <ul className="uiux-report-detail-list">
                          {card.items.map((item, itemIndex) => (
                            <li key={`${card.id}-${itemIndex}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </article>
                  ))
                ) : (
                  <p>상세 보고서가 없습니다.</p>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
