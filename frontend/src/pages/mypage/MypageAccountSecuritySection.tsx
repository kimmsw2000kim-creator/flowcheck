import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deactivateMypageAccount } from '../../api/mypageApi';
import { Button, Card, PageHeader } from '../../components/common';
import { useAlertStore } from '../../store/alertStore';
import { useUserStore } from '../../store/userStore';
import styles from '../../styles/mypage.module.css';

interface MypageAccountSecuritySectionProps { email: string; }

function MypageAccountSecuritySection({ email }: MypageAccountSecuritySectionProps) {
  const navigate = useNavigate();
  const logout = useUserStore((state) => state.logout);
  const showAlert = useAlertStore((state) => state.showAlert);
  const [deactivating, setDeactivating] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleDeactivate = async () => {
    const confirmed = window.confirm(
      '계정을 비활성화하면 로그아웃됩니다. 다음 로그인 때 다시 활성화할 수 있습니다. 계속하시겠습니까?',
    );
    if (!confirmed) return;

    const verification = window.prompt('계정 비활성화를 진행하려면 "비활성화"를 입력해주세요.');
    if (verification?.trim() !== '비활성화') {
      showAlert('비활성화 확인 문구가 일치하지 않습니다.', 'error');
      return;
    }

    try {
      setDeactivating(true);
      await deactivateMypageAccount();
      await logout();
      showAlert('계정이 비활성화되었습니다.', 'success');
      navigate('/login', { replace: true });
    } catch (error: unknown) {
      showAlert(error instanceof Error ? error.message : '계정을 비활성화하지 못했습니다.', 'error');
    } finally {
      setDeactivating(false);
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
            <strong>계정 비활성화</strong>
            <p>이용 이력은 보존되며, 다음 로그인 때 본인 확인 후 계정을 다시 활성화할 수 있습니다.</p>
          </div>
          <Button
            type="button"
            variant="danger"
            isLoading={deactivating}
            loadingText="비활성화 중..."
            onClick={handleDeactivate}
          >
            계정 비활성화
          </Button>
        </Card>
      </div>
    </section>
  );
}

export default MypageAccountSecuritySection;
