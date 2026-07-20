import apiClient from './client';

const UIUX_REQUEST_TIMEOUT_MS = 10_000;

// 이 파일은 UI/UX 테스트 관련 Spring API의 프론트 전용 계약을 모아 둔 곳입니다.
// 백엔드 DTO와 필드명을 맞춰야 하므로 requestId, bestPractices, timestampOffset 같은 camelCase를 그대로 사용합니다.
export interface StartUIUXTestResponse {
  requestId: string;
  status: string;
  message: string;
}

export interface UIUXTestStepData {
  // Python 워커가 /steps 콜백으로 남기는 진행 로그 한 줄입니다.
  // vncUrl이 포함된 step은 실시간 스트림 준비 상태의 근거가 되고, screenshotUrl은 VNC 연결 전 대체 프레임으로 사용됩니다.
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
  // /status polling 응답입니다.
  // RUNNING 중에는 steps/liveStream이 주로 바뀌고, COMPLETED 이후 scores/report/defects/videoUrl이 채워집니다.
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
  // /vnc-token 응답입니다.
  // ready=false이면 아직 컨테이너의 noVNC 서버가 준비되지 않은 상태라 프론트가 제한적으로 재시도합니다.
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
export async function getUIUXTestStatus(
  requestId: string,
  signal?: AbortSignal,
): Promise<UIUXTestStatusResponse> {
  const response = await apiClient.get(`/api/uiux-tests/${requestId}/status`, {
    signal,
    timeout: UIUX_REQUEST_TIMEOUT_MS,
  });
  return response.data;
}

export async function issueUIUXVncAccess(
  requestId: string,
  signal?: AbortSignal,
): Promise<UIUXVncAccessResponse> {
  // 실시간 화면 URL은 /status에 직접 노출하지 않고, 소유자 검증을 통과한 뒤 signed URL로 발급받습니다.
  const response = await apiClient.post(
    `/api/uiux-tests/${requestId}/vnc-token`,
    undefined,
    {
      signal,
      timeout: UIUX_REQUEST_TIMEOUT_MS,
    },
  );
  return response.data;
}

export async function cancelUIUXTest(requestId: string): Promise<void> {
  // 실행 중인 테스트를 사용자 요청으로 실패 상태 처리합니다.
  // 현재 구조에서는 프론트 표시와 백엔드 상태를 중지시키는 역할이며, 컨테이너 강제 종료는 별도 인프라 작업입니다.
  await apiClient.post(`/api/uiux-tests/${requestId}/cancel`);
}

export async function reportUIUXClientLog(requestId: string, event: string, detail?: Record<string, unknown>): Promise<void> {
  // VNC iframe 로드/오류, 토큰 재시도 같은 프론트 전용 진단 로그를 서버 로그로 남깁니다.
  // 사용자 기능에는 영향을 주지 않으므로 호출 실패는 상위에서 무시합니다.
  await apiClient.post(`/api/uiux-tests/${requestId}/client-log`, { event, detail });
}
