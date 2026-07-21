const KOREAN_TEXT_PATTERN = /[가-힣]/;

const KNOWN_ENGLISH_MESSAGES: Array<[RegExp, string]> = [
  [/invalid login credentials|invalid credentials/i, '이메일 또는 비밀번호가 올바르지 않습니다.'],
  [/email not confirmed/i, '이메일 인증이 완료되지 않았습니다. 받은 메일의 인증 링크를 확인해 주세요.'],
  [/user already registered|already been registered/i, '이미 가입된 계정입니다. 로그인하거나 비밀번호 찾기를 이용해 주세요.'],
  [/password should be at least|password.*too short/i, '비밀번호가 너무 짧습니다. 비밀번호 입력 조건을 확인해 주세요.'],
  [/new password should be different/i, '새 비밀번호는 기존 비밀번호와 다르게 입력해 주세요.'],
  [/email rate limit exceeded|over.*rate limit|too many requests/i, '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'],
  [/invalid refresh token|refresh token not found|auth session missing|session.*expired|jwt expired/i, '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.'],
  [/unable to validate email|invalid email|email.*invalid/i, '올바른 이메일 주소를 입력해 주세요.'],
  [/signup.*disabled/i, '현재 회원가입을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'],
  [/user.*banned/i, '현재 이용이 제한된 계정입니다. 관리자에게 문의해 주세요.'],
  [/user not found/i, '사용자 정보를 찾을 수 없습니다.'],
  [/unauthorized|not authorized|forbidden/i, '이 작업을 수행할 권한이 없습니다.'],
  [/failed to fetch|network request failed|network error|fetch failed|load failed/i, '서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.'],
  [/timeout|timed out/i, '요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'],
];

/**
 * 사용자에게 표시할 오류 문자열을 한국어로 정리합니다.
 * 백엔드나 외부 SDK가 새로운 영어 문구를 반환하면 원문 대신 화면별 대체 문구를 사용합니다.
 */
export function localizeErrorMessage(message: unknown, fallback: string): string {
  if (typeof message !== 'string' || !message.trim()) return fallback;

  const normalized = message.trim();
  const knownMessage = KNOWN_ENGLISH_MESSAGES.find(([pattern]) => pattern.test(normalized));
  if (knownMessage) return knownMessage[1];

  return KOREAN_TEXT_PATTERN.test(normalized) ? normalized : fallback;
}

export function getKoreanErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error) {
    const responseData = (error as {
      response?: { data?: unknown };
    }).response?.data;

    if (typeof responseData === 'string') {
      return localizeErrorMessage(responseData, fallback);
    }

    if (typeof responseData === 'object' && responseData) {
      const data = responseData as { message?: unknown; detail?: unknown; error?: unknown };
      for (const candidate of [data.message, data.detail, data.error]) {
        if (typeof candidate === 'string' && candidate.trim()) {
          return localizeErrorMessage(candidate, fallback);
        }
      }
    }

    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return localizeErrorMessage(message, fallback);
    }
  }

  return fallback;
}
