export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NICKNAME_PATTERN = /^[가-힣A-Za-z0-9_]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeNickname(value: string): string {
  return value.trim();
}

export function getEmailValidationError(value: string): string | undefined {
  const email = normalizeEmail(value);
  if (!email) return '이메일 주소를 입력해 주세요.';
  if (email.length > EMAIL_MAX_LENGTH) return `이메일 주소는 ${EMAIL_MAX_LENGTH}자 이하여야 합니다.`;
  if (!EMAIL_PATTERN.test(email)) return '올바른 이메일 주소를 입력해 주세요.';
  return undefined;
}

export function getPasswordValidationError(value: string): string | undefined {
  if (value.length < PASSWORD_MIN_LENGTH) return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
  if (value.length > PASSWORD_MAX_LENGTH) return `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하여야 합니다.`;
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return '비밀번호에 영문과 숫자를 각각 하나 이상 포함해 주세요.';
  return undefined;
}

export function getNicknameValidationError(value: string): string | undefined {
  const nickname = normalizeNickname(value);
  if (nickname.length < NICKNAME_MIN_LENGTH || nickname.length > NICKNAME_MAX_LENGTH) {
    return `닉네임은 ${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자로 입력해 주세요.`;
  }
  if (!NICKNAME_PATTERN.test(nickname)) return '닉네임은 한글, 영문, 숫자, 밑줄만 사용할 수 있습니다.';
  return undefined;
}
