import { useEffect, useState } from 'react';
import { EmptyState } from '../components/common';
import { supabase } from '../lib/supabaseClient';

export default function AuthCallback() {
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setErrorMessage('Google 로그인에 실패했습니다. 로그인 화면으로 이동합니다.');
        window.setTimeout(() => { window.location.href = '/login'; }, 1500);
        return;
      }
      localStorage.setItem('accessToken', data.session.access_token);
      localStorage.setItem('refreshToken', data.session.refresh_token);
      localStorage.setItem('email', data.session.user.email || '');
      window.location.href = '/';
    };
    handleCallback();
  }, []);

  return (
    <section className="utility-page utility-page--narrow auth-status" role="status" aria-live="polite">
      <EmptyState
        title={errorMessage || '로그인 처리 중입니다.'}
        description={errorMessage ? '잠시 후 로그인 화면으로 이동합니다.' : 'Google 계정 정보를 확인하고 있습니다.'}
      />
    </section>
  );
}
