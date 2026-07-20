import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../api/authApi';
import { Button, Card, EmptyState, PageHeader, TextField } from '../components/common';
import { useAlertStore } from '../store/alertStore';

export default function ForgotPasswordPage() {
  const showAlert = useAlertStore((state) => state.showAlert);
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSending(true);

    try {
      await requestPasswordReset(email);
      // 가입 여부를 화면에 노출하지 않는 동일한 완료 문구를 사용합니다.
      setIsSent(true);
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : '비밀번호 재설정 메일을 보내지 못했습니다.',
        'error',
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="utility-page utility-page--narrow">
      <Card padding="lg">
        {isSent ? (
          <EmptyState
            title="비밀번호 재설정 메일을 확인해 주세요"
            description="입력한 이메일로 가입된 계정이 있다면 재설정 링크가 전송됩니다. 메일함과 스팸함을 확인해 주세요."
            action={<Link className="auth-link" to="/login">로그인으로 돌아가기</Link>}
            role="status"
            aria-live="polite"
          />
        ) : (
          <>
            <PageHeader
              headingLevel={1}
              eyebrow="FLOWCHECK ACCOUNT"
              title="비밀번호 찾기"
              description="가입한 이메일 주소로 비밀번호 재설정 링크를 보내드립니다."
            />
            <form onSubmit={handleSubmit}>
              <TextField
                label="이메일 주소"
                type="email"
                autoComplete="email"
                placeholder="example@flowcheck.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={isSending}
              />
              <Button
                type="submit"
                fullWidth
                isLoading={isSending}
                loadingText="메일 전송 중..."
              >
                재설정 링크 받기
              </Button>
            </form>
            <div className="auth-secondary-action">
              <Link className="auth-link" to="/login">로그인으로 돌아가기</Link>
            </div>
          </>
        )}
      </Card>
    </section>
  );
}
