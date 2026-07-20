import { useEffect, useRef, useState } from 'react';
import { EventStreamContentType, fetchEventSource } from '@microsoft/fetch-event-source';
import axios from 'axios';
import apiClient from '../api/client';
import { getSupabaseAccessToken } from '../api/sessionApi';
import { useAlertStore } from '../store/alertStore';
import { useUserStore } from '../store/userStore';
import type { LoadTestResult } from '../types/loadTest';
import { useDomains } from './useDomains';

interface LoadTestStreamPayload {
  status: string;
  phase: string;
  progress: number;
  message: string;
}

type LoadStatus = 'idle' | 'running' | 'success' | 'error';

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

export function useLoadTest(
  selectedLoadDomain: number,
  setSelectedLoadDomain: (id: number) => void,
) {
  const currentUser = useUserStore((state) => state.currentUser);
  const showAlert = useAlertStore((state) => state.showAlert);
  const { domains } = useDomains();

  const [vusers, setVusers] = useState<number>(100);
  const [duration, setDuration] = useState<number>(300);
  const [loadPrompt, setLoadPrompt] = useState<string>('');
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [loadPhase, setLoadPhase] = useState<string>('');
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [loadMessage, setLoadMessage] = useState<string>('');
  const [loadResult, setLoadResult] = useState<LoadTestResult | null>(null);
  const streamRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.abort();
    };
  }, []);

  const handleErrorResponse = (error: unknown) => {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const data = error.response.data;
      const errorMessage = typeof data === 'string' ? data : data?.message;

      switch (status) {
        case 400:
          showAlert(errorMessage || '잘못된 요청입니다. 입력값을 다시 확인해주세요.', 'error');
          break;
        case 402:
          showAlert(errorMessage || '크레딧 잔액 또는 쿠폰이 부족합니다. 충전 후 다시 시도해주세요.', 'error');
          break;
        case 404:
          showAlert('요청한 테스트 내역이나 리소스를 찾을 수 없습니다.', 'error');
          break;
        case 500:
          showAlert('서버 내부에서 예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'error');
          break;
        default:
          showAlert(errorMessage || `서버 통신 오류가 발생했습니다. (코드: ${status})`, 'error');
          break;
      }
      return;
    }

    showAlert('서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.', 'error');
  };

  const subscribeLoadTestStream = async (requestId: string) => {
    if (!requestId) {
      console.error('유효하지 않은 requestId입니다.');
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
                const { testResults } = resultResponse.data;

                if (testResults && testResults.maxTps !== undefined) {
                  setLoadStatus('success');
                  setLoadResult({
                    maxTps: testResults.maxTps,
                    avgResponse: testResults.avgResponse,
                    errorRate: testResults.errorRate,
                    performanceScore: testResults.performanceScore,
                    performanceGrade: testResults.performanceGrade,
                    scoreLabel: testResults.scoreLabel,
                    scoreBreakdown: testResults.scoreBreakdown,
                    bottleneckComment: testResults.bottleneckComment,
                    points: testResults.points || [],
                  });
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

  const runLoadTest = async () => {
    const targetUrl = domains.find((domain) => domain.id === selectedLoadDomain)?.domainUrl;

    if (!targetUrl?.trim()) {
      showAlert('테스트할 웹사이트 URL을 입력해 주세요.', 'error');
      return;
    }

    if (currentUser.loadTestCoupons <= 0 && currentUser.balance < 10000) {
      showAlert('부하 테스트 쿠폰 또는 크레딧 잔액이 부족합니다.', 'error');
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
    setLoadResult(null);

    try {
      const response = await apiClient.post('/api/load-tests', payload);
      const { requestId } = response.data;
      void subscribeLoadTestStream(requestId);
    } catch (error) {
      console.error('Failed to run load test:', error);
      setLoadStatus('error');
      handleErrorResponse(error);
    }
  };

  return {
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
  };
}
