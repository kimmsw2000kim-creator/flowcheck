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
  deviceInfo?: any;
  defects?: UIUXTestDefect[];
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
