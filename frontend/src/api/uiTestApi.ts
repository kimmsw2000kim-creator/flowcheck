import apiClient from './client';

export interface StartUiTestResponse {
  requestId: string;
  status: string;
  message: string;
}

export interface UiTestStepData {
  step: number;
  url: string;
  action: string;
  selector?: string;
  text?: string;
  reason?: string;
  error?: string;
}

export interface UiTestStatusResponse {
  requestId: string;
  status: string;
  targetUrl: string;
  report?: string;
  steps: UiTestStepData[];
}

/**
 * UI 탐색 테스트를 시작합니다.
 */
export async function startUiTest(targetUrl: string, userId: string): Promise<StartUiTestResponse> {
  const response = await apiClient.post('/api/ui-tests',
    { targetUrl }
  );
  return response.data;
}

/**
 * 실시간 UI 탐색 테스트 상태 및 단계 정보를 조회합니다.
 */
export async function getUiTestStatus(requestId: string): Promise<UiTestStatusResponse> {
  const response = await apiClient.get(`/api/ui-tests/${requestId}/status`);
  return response.data;
}
