import apiClient from './client';

export interface StartUIUXTestResponse {
  requestId: string;
  status: string;
  message: string;
}

export interface UIUXTestStepData {
  step: number;
  url: string;
  action: string;
  selector?: string;
  text?: string;
  reason?: string;
  error?: string;
  vncUrl?: string;
  screenshotUrl?: string;
}

export interface UIUXTestScores {
  usability: number;
  accessibility: number;
  efficiency: number;
  performance: number;
  bestPractices?: number;
  overall?: number;
}

export interface UIUXLiveStreamStatus {
  status: 'WAITING' | 'READY' | 'ENDED' | 'FAILED' | string;
  enabled: boolean;
  message?: string;
  vncHost?: string;
  vncPort?: number;
}

export interface UIUXTestDefect {
  id?: number;
  category: string;
  selector: string;
  severity: string;
  description: string;
  timestampOffset: number;
  source?: string;
  ruleId?: string;
  evidence?: Record<string, unknown>;
  recommendation?: string;
  screenshotUrl?: string;
}

export interface UIUXTestStatusResponse {
  requestId: string;
  status: string;
  targetUrl: string;
  report?: string;
  steps: UIUXTestStepData[];
  scores?: UIUXTestScores;
  scoreBreakdown?: Record<string, unknown>;
  evaluationVersion?: string;
  videoUrl?: string;
  liveStream?: UIUXLiveStreamStatus;
  deviceInfo?: any;
  defects?: UIUXTestDefect[];
}

export interface UIUXVncAccessResponse {
  ready: boolean;
  url?: string;
  expiresAt: number;
  message?: string;
}

/**
 * UI 탐색 테스트를 시작합니다.
 */
export async function startUIUXTest(targetUrl: string): Promise<StartUIUXTestResponse> {
  const response = await apiClient.post('/api/uiux-tests',
    { targetUrl }
  );
  return response.data;
}

/**
 * 실시간 UI 탐색 테스트 상태 및 단계 정보를 조회합니다.
 */
export async function getUIUXTestStatus(requestId: string): Promise<UIUXTestStatusResponse> {
  const response = await apiClient.get(`/api/uiux-tests/${requestId}/status`);
  return response.data;
}

export async function issueUIUXVncAccess(requestId: string): Promise<UIUXVncAccessResponse> {
  const response = await apiClient.post(`/api/uiux-tests/${requestId}/vnc-token`);
  return response.data;
}

export async function cancelUIUXTest(requestId: string): Promise<void> {
  await apiClient.post(`/api/uiux-tests/${requestId}/cancel`);
}

export async function reportUIUXClientLog(requestId: string, event: string, detail?: Record<string, unknown>): Promise<void> {
  await apiClient.post(`/api/uiux-tests/${requestId}/client-log`, { event, detail });
}
