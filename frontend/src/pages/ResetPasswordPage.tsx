import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Link, useNavigate } from 'react-router-dom';
import { updatePassword } from '../api/authApi';
import { Button, Card, EmptyState, PageHeader, TextField } from '../components/common';
import { supabase } from '../lib/supabaseClient';
import { useAlertStore } from '../store/alertStore';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  getPasswordValidationError,
} from '../utils/authValidation';

type RecoveryState = 'checking' | 'ready' | 'invalid';

function getRecoveryLinkError(): string | null {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const queryParams = new URLSearchParams(window.location.search);
  return hashParams.get('error_description') ?? queryParams.get('error_description');
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const showAlert = useAlertStore((state) => state.showAlert);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>('checking');
  const [recoveryError, setRecoveryError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const passwordValidationError = password.length > 0 ? getPasswordValidationError(password) : undefined;
  const passwordConfirmTouched = passwordConfirm.length > 0;
  const passwordMatched = password === passwordConfirm;

  useEffect(() => {
    let disposed = false;
    const linkError = getRecoveryLinkError();

    if (linkError) {
      setRecoveryError(linkError);
      setRecoveryState('invalid');
      return undefined;
    }

    const acceptSession = (session: Session | null) => {
      if (disposed) return;
      setRecoveryState(session ? 'ready' : 'invalid');
    };

    // 이벤트를 먼저 구독해야 초기 URL 처리 중 발생하는 PASSWORD_RECOVERY를 놓치지 않습니다.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        acceptSession(session);
      }
      if (event === 'SIGNED_OUT') acceptSession(null);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (disposed) return;
      if (error) {
        setRecoveryError(error.message);
        setRecoveryState('invalid');
        return;
      }
      acceptSession(data.session);
    });

    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = getPasswordValidationError(password);
    if (validationError) {
      showAlert(validationError, 'error');
      return;
    }

    if (password !== passwordConfirm) {
      showAlert('비밀번호가 일치하지 않습니다.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await updatePassword(password);
      // 복구용 세션을 종료해 새 비밀번호로 다시 로그인하도록 합니다.
      await supabase.auth.signOut();
      showAlert('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.', 'success');
      navigate('/login', { replace: true });
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : '비밀번호를 변경하지 못했습니다.',
        'error',
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (recoveryState === 'checking') {
    return (
      <section className="utility-page utility-page--narrow auth-status" role="status" aria-live="polite">
        <EmptyState
          title="재설정 링크를 확인하고 있습니다"
          description="잠시만 기다려 주세요."
        />
      </section>
    );
  }

  if (recoveryState === 'invalid') {
    return (
      <section className="utility-page utility-page--narrow auth-status">
        <EmptyState
          title="재설정 링크를 사용할 수 없습니다"
          description={recoveryError || '링크가 만료되었거나 이미 사용되었습니다. 새 링크를 요청해 주세요.'}
          action={<Link className="auth-link" to="/forgot-password">재설정 링크 다시 받기</Link>}
        />
      </section>
    );
  }

  return (
    <section className="utility-page utility-page--narrow">
      <Card padding="lg">
        <PageHeader
          headingLevel={1}
          eyebrow="FLOWCHECK ACCOUNT"
          title="새 비밀번호 설정"
          description="앞으로 사용할 새 비밀번호를 입력해 주세요."
        />
        <form onSubmit={handleSubmit}>
          <TextField
            label="새 비밀번호"
            type="password"
            autoComplete="new-password"
            placeholder="새 비밀번호를 입력하세요"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            error={passwordValidationError}
            description={!passwordValidationError && password.length > 0 ? '사용 가능한 비밀번호 형식입니다.' : '8자 이상, 영문과 숫자를 포함해 주세요.'}
            required
            disabled={isSaving}
          />
          <TextField
            label="새 비밀번호 확인"
            type="password"
            autoComplete="new-password"
            placeholder="새 비밀번호를 다시 입력하세요"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            error={passwordConfirmTouched && !passwordMatched ? '비밀번호가 일치하지 않습니다.' : undefined}
            description={passwordConfirmTouched && passwordMatched ? '비밀번호가 일치합니다.' : undefined}
            required
            disabled={isSaving}
          />
          <Button
            type="submit"
            fullWidth
            isLoading={isSaving}
            loadingText="변경 중..."
            disabled={!passwordMatched || Boolean(passwordValidationError)}
          >
            비밀번호 변경하기
          </Button>
        </form>
      </Card>
    </section>
  );
}
