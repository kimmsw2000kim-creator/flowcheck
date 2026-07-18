import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { withdrawMypageAccount } from '../../api/mypageApi';
import { Button, Card, PageHeader } from '../../components/common';
import { useAlertStore } from '../../store/alertStore';
import { useUserStore } from '../../store/userStore';
import styles from '../../styles/mypage.module.css';

interface MypageAccountSecuritySectionProps { email: string; }

function MypageAccountSecuritySection({ email }: MypageAccountSecuritySectionProps) {
  const navigate = useNavigate();
  const logout = useUserStore((state) => state.logout);
  const showAlert = useAlertStore((state) => state.showAlert);
  const [withdrawing, setWithdrawing] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleWithdraw = async () => {
    const confirmed = window.confirm(
      '탈퇴하면 같은 계정으로 다시 로그인할 수 없습니다. 계속하시겠습니까?',
    );
    if (!confirmed) return;

    const verification = window.prompt('탈퇴를 진행하려면 "탈퇴"를 입력해주세요.');
    if (verification?.trim() !== '탈퇴') {
      showAlert('탈퇴 확인 문구가 일치하지 않습니다.', 'error');
      return;
    }

    try {
      setWithdrawing(true);
      await withdrawMypageAccount();
      await logout();
      showAlert('회원 탈퇴가 완료되었습니다.', 'success');
      navigate('/login', { replace: true });
    } catch (error: unknown) {
      showAlert(error instanceof Error ? error.message : '회원 탈퇴를 처리하지 못했습니다.', 'error');
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <section className={styles['mypage-section']}>
      <PageHeader headingLevel={1} eyebrow="ACCOUNT" title="계정 · 보안" description="로그인 계정과 현재 세션을 관리합니다." />
      <div className={styles['account-panel']}>
        <Card className={styles['account-row']}>
          <div><strong>이메일</strong><p>{email || '로그인 정보 없음'}</p></div>
        </Card>
        <Card className={styles['account-row']} variant="outlined">
          <div><strong>로그아웃</strong><p>현재 기기에서 FlowCheck 세션을 종료합니다.</p></div>
          <Button type="button" variant="danger" onClick={handleLogout}>로그아웃</Button>
        </Card>
        <Card className={styles['account-row']} variant="outlined">
          <div>
            <strong>회원 탈퇴</strong>
            <p>계정과 이용 이력은 보존되며, 탈퇴 후 같은 계정으로 다시 로그인할 수 없습니다.</p>
          </div>
          <Button
            type="button"
            variant="danger"
            isLoading={withdrawing}
            loadingText="탈퇴 처리 중..."
            onClick={handleWithdraw}
          >
            회원 탈퇴
          </Button>
        </Card>
      </div>
    </section>
  );
}

export default MypageAccountSecuritySection;
