import { useNavigate } from 'react-router-dom';
import { Button, Card, PageHeader } from '../../components/common';
import { useUserStore } from '../../store/userStore';
import styles from '../../styles/mypage.module.css';

interface MypageAccountSecuritySectionProps { email: string; }

function MypageAccountSecuritySection({ email }: MypageAccountSecuritySectionProps) {
  const navigate = useNavigate();
  const logout = useUserStore((state) => state.logout);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
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
      </div>
    </section>
  );
}

export default MypageAccountSecuritySection;
