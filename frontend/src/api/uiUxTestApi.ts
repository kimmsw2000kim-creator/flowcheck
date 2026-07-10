import apiClient from './client';

export interface StartUiUxTestResponse {
  requestId: string;
  status: string;
  message: string;
}

export interface UiUxTestStepData {
  step: number;
  url: string;
  action: string;
  selector?: string;
  text?: string;
  reason?: string;
  error?: string;
}

export interface UiUxTestStatusResponse {
  requestId: string;
  status: string;
  targetUrl: string;
  report?: string;
  steps: UiUxTestStepData[];
}

/**
 * UI 탐색 테스트를 시작합니다.
 */
export async function startUiUxTest(targetUrl: string): Promise<StartUiUxTestResponse> {
  const response = await apiClient.post('/api/ui-tests',
    { targetUrl }
  );
  return response.data;
}

/**
 * 실시간 UI 탐색 테스트 상태 및 단계 정보를 조회합니다.
 */
export async function getUiUxTestStatus(requestId: string): Promise<UiUxTestStatusResponse> {
  const response = await apiClient.get(`/api/ui-tests/${requestId}/status`);
  return response.data;
}
