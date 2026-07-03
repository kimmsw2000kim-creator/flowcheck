const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

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

export async function startUiTest(targetUrl: string, userId: string): Promise<StartUiTestResponse> {
  const response = await fetch(`${API_BASE_URL}/api/ui-tests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": userId,
    },
    body: JSON.stringify({ targetUrl }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "UI 탐색 테스트 시작에 실패했습니다.");
  }

  return response.json();
}

export async function getUiTestStatus(requestId: string): Promise<UiTestStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/ui-tests/${requestId}/status`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error("실시간 탐색 상태를 조회하지 못했습니다.");
  }

  return response.json();
}
