import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import { AccountDeactivatedError, login, reactivateAccount, signup, validateActiveSession } from '../api/authApi';
import { supabase } from '../lib/supabaseClient';
import { Button, Card, PageHeader, TextField } from '../components/common';
import { useAlertStore } from '../store/alertStore';
import { useUserStore } from '../store/userStore';
import {
  EMAIL_MAX_LENGTH,
  NICKNAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  getEmailValidationError,
  getNicknameValidationError,
  getPasswordValidationError,
} from '../utils/authValidation';

export interface AuthPageProps {
  setActiveTab: (tab: string) => void;
  initialMode?: 'login' | 'signup';
}

type AuthMode = 'login' | 'signup';
const modes: AuthMode[] = ['login', 'signup'];
const REMEMBERED_EMAIL_STORAGE_KEY = 'flowcheck.rememberedEmail';

function getRememberedEmail(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(REMEMBERED_EMAIL_STORAGE_KEY) ?? '';
}

export default function AuthPage({ setActiveTab, initialMode = 'login' }: AuthPageProps) {
  const showAlert = useAlertStore((state) => state.showAlert);
  const loginSuccess = useUserStore((state) => state.loginSuccess);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState(getRememberedEmail);
  const [rememberEmail, setRememberEmail] = useState(() => Boolean(getRememberedEmail()));
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [loadingAction, setLoadingAction] = useState<'form' | 'google' | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const googleSessionHandledRef = useRef(false);

  const passwordConfirmTouched = passwordConfirm.length > 0;
  const passwordMatched = password === passwordConfirm;
  const emailError = mode === 'signup' && email.length > 0 ? getEmailValidationError(email) : undefined;
  const passwordStrengthError = mode === 'signup' && password.length > 0 ? getPasswordValidationError(password) : undefined;
  const passwordConfirmError = mode === 'signup' && passwordConfirmTouched && !passwordMatched ? '비밀번호가 일치하지 않습니다.' : undefined;
  const nicknameError = mode === 'signup' && nickname.length > 0 ? getNicknameValidationError(nickname) : undefined;
  const signupFormInvalid = Boolean(emailError || passwordStrengthError || passwordConfirmError || nicknameError);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    if (nextMode === 'login') setPasswordConfirm('');
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % modes.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + modes.length) % modes.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = modes.length - 1;
    changeMode(modes[nextIndex]);
    tabRefs.current[nextIndex]?.focus();
  };

  const googleLogin = async () => {
    try {
      setLoadingAction('google');
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      if (error) throw error;
    } catch (error) {
      showAlert(error instanceof Error ? error.message : 'Google 로그인에 실패했습니다.', 'error');
      setLoadingAction(null);
    }
  };

  const completeGoogleLogin = useCallback(async (session: Session) => {
    if (googleSessionHandledRef.current) return;
    const user = session.user;
    if (user.app_metadata?.provider !== 'google') return;
    if (!user.email) {
      showAlert('Google 계정에서 이메일 정보를 가져오지 못했습니다.', 'error');
      return;
    }
    googleSessionHandledRef.current = true;
    let activeSession = session;

    try {
      try {
        await validateActiveSession(activeSession);
      } catch (error) {
        if (!(error instanceof AccountDeactivatedError)) throw error;

        const confirmed = window.confirm('비활성화된 계정입니다. 계정을 다시 활성화하고 로그인하시겠습니까?');
        if (!confirmed) {
          await supabase.auth.signOut();
          showAlert('계정 재활성화를 취소했습니다.', 'info');
          return;
        }
        activeSession = await reactivateAccount(error.session);
      }
      localStorage.setItem('accessToken', activeSession.access_token);
      localStorage.setItem('refreshToken', activeSession.refresh_token);
      localStorage.setItem('email', user.email);
      localStorage.setItem('userId', user.id);
      loginSuccess(user.email, activeSession.access_token, user.id);
      showAlert('Google 계정으로 로그인되었습니다.', 'success');
      setActiveTab('dashboard');
      window.history.replaceState({}, document.title, window.location.origin);
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '계정 상태를 확인하지 못했습니다.', 'error');
    }
  }, [loginSuccess, setActiveTab, showAlert]);

  useEffect(() => {
    const accountAccessMessage = sessionStorage.getItem('accountAccessMessage');
    if (accountAccessMessage) {
      sessionStorage.removeItem('accountAccessMessage');
      showAlert(accountAccessMessage, 'error');
    }
  }, [showAlert]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error(error);
      if (data.session) void completeGoogleLogin(data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) void completeGoogleLogin(session);
    });
    return () => subscription.unsubscribe();
  }, [completeGoogleLogin]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === 'signup') {
      const validationError = getEmailValidationError(email)
        ?? getPasswordValidationError(password)
        ?? getNicknameValidationError(nickname)
        ?? (!passwordMatched ? '비밀번호가 일치하지 않습니다.' : undefined);
      if (validationError) {
        showAlert(validationError, 'error');
        return;
      }
    }
    setLoadingAction('form');
    try {
      if (mode === 'login') {
        let data;
        let reactivated = false;
        try {
          data = await login({ email, password });
        } catch (error) {
          if (!(error instanceof AccountDeactivatedError)) throw error;

          const confirmed = window.confirm('비활성화된 계정입니다. 계정을 다시 활성화하고 로그인하시겠습니까?');
          if (!confirmed) {
            await supabase.auth.signOut();
            showAlert('계정 재활성화를 취소했습니다.', 'info');
            return;
          }

          const reactivatedSession = await reactivateAccount(error.session);
          data = { session: reactivatedSession, user: reactivatedSession.user };
          reactivated = true;
        }
        if (data.session && data.user) {
          if (rememberEmail) {
            localStorage.setItem(REMEMBERED_EMAIL_STORAGE_KEY, email.trim());
          } else {
            localStorage.removeItem(REMEMBERED_EMAIL_STORAGE_KEY);
          }
          loginSuccess(data.user.email, data.session.access_token, data.user.id);
          showAlert(reactivated ? '계정을 재활성화하고 로그인했습니다.' : '로그인에 성공했습니다.', 'success');
          setActiveTab('dashboard');
        }
      } else {
        const data = await signup({ email, password, nickname });
        showAlert(data.session === null ? data.message || '회원가입 요청이 완료되었습니다. 이메일 인증 후 로그인해 주세요.' : '회원가입이 완료되었습니다.', 'success');
        changeMode('login');
        setPassword('');
        setPasswordConfirm('');
      }
    } catch (error) {
      showAlert(error instanceof Error ? error.message : `${mode === 'login' ? '로그인' : '회원가입'}에 실패했습니다.`, 'error');
    } finally { setLoadingAction(null); }
  };

  return (
    <section className="utility-page utility-page--narrow">
      <Card padding="lg">
        <PageHeader
          headingLevel={1}
          eyebrow="FLOWCHECK ACCOUNT"
          title={mode === 'login' ? '로그인' : '회원가입'}
          description={mode === 'login' ? 'FlowCheck 업무 화면으로 돌아갑니다.' : '테스트를 시작할 계정을 만듭니다.'}
        />
        <div className="auth-tabs" role="tablist" aria-label="인증 방식">
          {modes.map((tabMode, index) => (
            <button
              key={tabMode}
              ref={(element) => { tabRefs.current[index] = element; }}
              type="button"
              role="tab"
              id={`auth-tab-${tabMode}`}
              aria-selected={mode === tabMode}
              aria-controls={`auth-panel-${tabMode}`}
              tabIndex={mode === tabMode ? 0 : -1}
              className="auth-tab"
              onClick={() => changeMode(tabMode)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {tabMode === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>
        <form id={`auth-panel-${mode}`} role="tabpanel" aria-labelledby={`auth-tab-${mode}`} onSubmit={handleSubmit}>
          <TextField label="이메일 주소" type="email" autoComplete="email" placeholder="example@flowcheck.com" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={EMAIL_MAX_LENGTH} error={emailError} required disabled={loadingAction !== null} />
          <TextField label="비밀번호" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="비밀번호를 입력하세요" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={mode === 'signup' ? PASSWORD_MAX_LENGTH : undefined} error={passwordStrengthError} description={mode === 'signup' && !passwordStrengthError ? '8자 이상, 영문과 숫자를 포함해 주세요.' : undefined} required disabled={loadingAction !== null} />
          {mode === 'login' && (
            <div className="auth-login-options">
              <label className="auth-remember-email">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  disabled={loadingAction !== null}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setRememberEmail(checked);
                    if (!checked) localStorage.removeItem(REMEMBERED_EMAIL_STORAGE_KEY);
                  }}
                />
                <span>아이디 기억하기</span>
              </label>
              <Link className="auth-link" to="/forgot-password">비밀번호를 잊으셨나요?</Link>
            </div>
          )}
          {mode === 'signup' && <TextField label="비밀번호 확인" type="password" autoComplete="new-password" placeholder="비밀번호를 다시 입력하세요" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} maxLength={PASSWORD_MAX_LENGTH} error={passwordConfirmError} description={passwordConfirmTouched && passwordMatched ? '비밀번호가 일치합니다.' : undefined} required disabled={loadingAction !== null} />}
          {mode === 'signup' && <TextField label="닉네임" type="text" autoComplete="nickname" placeholder="사용하실 닉네임" value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={NICKNAME_MAX_LENGTH} error={nicknameError} description={!nicknameError && nickname.length > 0 ? '사용 가능한 형식입니다.' : '2~20자의 한글, 영문, 숫자, 밑줄을 사용할 수 있습니다.'} required disabled={loadingAction !== null} />}
          <Button type="submit" fullWidth isLoading={loadingAction === 'form'} loadingText="처리 중..." disabled={loadingAction !== null || signupFormInvalid}>{mode === 'login' ? '로그인' : '회원가입 완료'}</Button>
        </form>
        <div className="auth-divider" aria-hidden="true">또는</div>
        <Button type="button" variant="secondary" fullWidth onClick={googleLogin} isLoading={loadingAction === 'google'} loadingText="Google 연결 중..." disabled={loadingAction !== null}>Google 계정으로 로그인</Button>
      </Card>
    </section>
  );
}
