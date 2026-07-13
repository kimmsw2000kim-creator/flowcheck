import React, { useEffect, useRef, useState } from 'react';
import { EventStreamContentType, fetchEventSource } from '@microsoft/fetch-event-source';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import axios from 'axios';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import apiClient from '../api/client';
import { getSupabaseAccessToken } from '../api/sessionApi';

interface Domain {
  id: number;
  domainUrl: string;
  verified: boolean;
}

interface LoadChartDataPoint {
  time: string;
  tps: number;
  avgResponse: number;
}

interface LoadMetrics {
  maxTps: number;
  avgResponse: number;
  errorRate: number;
  bottleneckComment: string;
}

interface LoadTestStreamPayload {
  status: string;
  phase: string;
  progress: number;
  message: string;
  testResults?: {
    maxTps: number;
    avgResponse: number;
    errorRate: number;
    bottleneckComment: string;
    points: LoadChartDataPoint[];
  };
}

class FatalSseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FatalSseError';
  }
}

class RetriableSseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetriableSseError';
  }
}

const phaseLabels: Record<string, string> = {
  QUEUED: '대기 중',
  PREPARING_REQUEST: '요청 준비 중',
  CALLING_FASTAPI: 'FastAPI 호출 중',
  PROCESSING_RESULTS: '결과 처리 중',
  SAVING_REPORT: '리포트 저장 중',
  COMPLETED: '완료',
  FAILED: '실패',
};

import { useUserStore } from '../store/userStore';
import { useAlertStore } from '../store/alertStore';

import { useDomains } from '../hooks/useDomains';

interface LoadPageProps {
  onAddLedger: (ledgerItem: any) => void;
}

export default function LoadPage({
  onAddLedger
}: LoadPageProps) {
  const currentUser = useUserStore((state) => state.currentUser);
  const onUserUpdate = useUserStore((state) => state.updateUserBalanceAndCoupons);
  const showAlert = useAlertStore((state) => state.showAlert);
  const { domains } = useDomains();

  const [selectedLoadDomain, setSelectedLoadDomain] = useState<number>(0);
  const [vusers, setVusers] = useState<number>(100);
  const [duration, setDuration] = useState<number>(30);
  const [loadPrompt, setLoadPrompt] = useState<string>('');
  const [loadStatus, setLoadStatus] = useState<string>('idle'); // idle, running, success, error
  const [loadPhase, setLoadPhase] = useState<string>('');
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [loadMessage, setLoadMessage] = useState<string>('');
  const [loadMetrics, setLoadMetrics] = useState<LoadMetrics | null>(null);
  const [loadChartData, setLoadChartData] = useState<LoadChartDataPoint[]>([]);
  const streamRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.abort();
    };
  }, []);

  const handleRunLoadTest = async () => {
    const targetUrl = domains.find(d => d.id === selectedLoadDomain)?.domainUrl;

    if (!targetUrl?.trim()) {
      showAlert('테스트할 웹사이트 URL을 입력해 주세요.', 'error');
      return;
    }

    if (currentUser.coupons <= 0 && currentUser.balance < 10000) {
      showAlert('쿠폰 또는 크레딧 잔액이 부족합니다.', 'error');
      return;
    }

    const payload = {
      requestId: crypto.randomUUID(),
      targetUrl,
      vusers,
      duration,
      loadPrompt,
    };

    setLoadStatus('running');
    setLoadPhase('QUEUED');
    setLoadProgress(0);
    setLoadMessage('요청을 백엔드에 전달하는 중입니다.');

    try {
      const response = await apiClient.post("/api/load-tests", payload);

      const { requestId } = response.data;
      void subscribeLoadTestStream(requestId);

    } catch (error) {
      console.error('Failed to run load test:', error);
      setLoadStatus('error');
      handleErrorResponse(error);
    }
  };

  const subscribeLoadTestStream = async (requestId: string) => {
    if (!requestId) {
      console.error("유효하지 않은 requestId입니다.");
      return;
    }

    streamRef.current?.abort();
    const controller = new AbortController();
    streamRef.current = controller;
    let retryCount = 0;

    try {
      await fetchEventSource(`/api/load-tests/${requestId}/stream`, {
        signal: controller.signal,
        openWhenHidden: true,
        fetch: async (input, init) => {
          const accessToken = await getSupabaseAccessToken();

          if (!accessToken) {
            throw new FatalSseError('로그인 세션을 확인할 수 없습니다. 다시 로그인해 주세요.');
          }

          const headers = new Headers(init?.headers);
          headers.set('Authorization', `Bearer ${accessToken}`);

          return window.fetch(input, {
            ...init,
            headers,
          });
        },
        async onopen(response) {
          const contentType = response.headers.get('content-type');

          if (response.ok && contentType?.startsWith(EventStreamContentType)) {
            retryCount = 0;
            return;
          }

          if (response.status === 401) {
            throw new FatalSseError('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
          }

          if (response.status === 403) {
            throw new FatalSseError('이 부하 테스트 스트림에 접근할 권한이 없습니다.');
          }

          if (response.status === 404) {
            throw new FatalSseError('부하 테스트 요청을 찾을 수 없습니다.');
          }

          if (response.ok) {
            throw new FatalSseError('서버가 올바른 SSE 응답을 반환하지 않았습니다.');
          }

          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new FatalSseError(`SSE 연결이 거부되었습니다. (코드: ${response.status})`);
          }

          throw new RetriableSseError(`SSE 서버가 응답하지 않습니다. (코드: ${response.status})`);
        },
        onmessage(event) {
          let data: LoadTestStreamPayload;

          try {
            data = JSON.parse(event.data) as LoadTestStreamPayload;
          } catch {
            throw new FatalSseError('SSE 응답을 해석할 수 없습니다.');
          }

          console.log('Stream update:', data);
          setLoadPhase(data.phase || '');
          setLoadProgress(typeof data.progress === 'number' ? data.progress : 0);
          setLoadMessage(data.message || '');

          if (data.status === 'FAILED') {
            setLoadStatus('error');
            showAlert(data.message || '테스트 수행 중 오류가 발생했습니다.', 'error');
            controller.abort();
            return;
          }

          if (data.status === 'COMPLETED') {
            controller.abort();
            void apiClient.get(`/api/load-tests/${requestId}`)
              .then((resultResponse) => {
                const resultData = resultResponse.data;
                const { testResults } = resultData;

                if (testResults && testResults.maxTps !== undefined) {
                  setLoadStatus('success');
                  setLoadMetrics({
                    maxTps: testResults.maxTps,
                    avgResponse: testResults.avgResponse,
                    errorRate: testResults.errorRate,
                    bottleneckComment: testResults.bottleneckComment
                  });
                  setLoadChartData(testResults.points);

                  showAlert('k6 부하 테스트가 완료되었습니다!', 'success');
                }
              })
              .catch((resultError) => {
                console.error('Failed to load final result:', resultError);
                setLoadStatus('error');
                showAlert('최종 결과를 불러오지 못했습니다.', 'error');
              });
          }
        },
        onclose() {
          if (!controller.signal.aborted) {
            throw new RetriableSseError('SSE 연결이 예기치 않게 종료되었습니다.');
          }
        },
        onerror(error) {
          if (error instanceof FatalSseError) {
            throw error;
          }

          retryCount += 1;
          if (retryCount > 5) {
            throw new FatalSseError('실시간 상태 연결에 반복적으로 실패했습니다. 잠시 후 다시 시도해 주세요.');
          }

          const retryDelay = Math.min(1000 * 2 ** (retryCount - 1), 10000);
          console.warn(`SSE connection retry ${retryCount}/5 in ${retryDelay}ms`, error);
          return retryDelay;
        },
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error('SSE stream error:', error);
        setLoadStatus('error');
        showAlert(
          error instanceof FatalSseError
            ? error.message
            : '실시간 상태 연결 중 오류가 발생했습니다.',
          'error',
        );
      }
    } finally {
      if (streamRef.current === controller) {
        streamRef.current = null;
      }
    }
  };

  const handleErrorResponse = (error: any) => {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const data = error.response.data;

      // 백엔드 컨트롤러가 단순 문자열(body(e.getMessage()))을 보냈는지, 
      // JSON 객체({message: '...'}) 형태로 보냈는지 안전하게 파싱
      const errorMessage = typeof data === 'string' ? data : data?.message;

      switch (status) {
        case 400: // Bad Request (IllegalArgumentException)
          showAlert(errorMessage || '잘못된 요청입니다. 입력값을 다시 확인해주세요.', 'error');
          break;

        case 402: // Payment Required (IllegalStateException)
          showAlert(errorMessage || '크레딧 잔액 또는 쿠폰이 부족합니다. 충전 후 다시 시도해주세요.', 'error');
          break;

        case 404: // Not Found
          showAlert('요청한 테스트 내역이나 리소스를 찾을 수 없습니다.', 'error');
          break;

        case 500: // Internal Server Error
          showAlert('서버 내부에서 예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'error');
          break;

        default: // 기타 상태 코드
          showAlert(errorMessage || `서버 통신 오류가 발생했습니다. (코드: ${status})`, 'error');
          break;
      }
    }
    // 서버에 도달하지 못했거나(CORS, 타임아웃 등) 프론트 단의 에러인 경우
    else {
      showAlert('서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.', 'error');
    }
  };

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
              onClick={handleRunLoadTest}
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
                <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>최대 초당 처리량 (Max TPS)</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{loadMetrics.maxTps.toFixed(1)} req/s</div>
                  </div>
                  <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>평균 응답 속도</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{loadMetrics.avgResponse.toFixed(0)} ms</div>
                  </div>
                  <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>에러율</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: loadMetrics.errorRate > 0 ? 'var(--error)' : 'var(--success)' }}>
                      {loadMetrics.errorRate.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Line Chart */}
                <div style={{ height: '300px', width: '100%', marginBottom: '2rem' }}>
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

                <div className="markdown-body" style={{ background: 'var(--bg-tertiary)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{loadMetrics.bottleneckComment}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
