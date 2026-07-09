import { useNavigate } from 'react-router-dom';
import { logout } from '../../api/authApi';
import styles from '../../styles/mypage.module.css';

interface MypageAccountSecuritySectionProps {
    email: string;
}

function MypageAccountSecuritySection({ email }: MypageAccountSecuritySectionProps) {
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <section className={styles['mypage-section']}>
            <h1>계정 · 보안</h1>
            <p>이메일, 비밀번호, 소셜 로그인 연결 상태를 관리합니다.</p>

            <div className={styles['account-panel']}>
                <div className={styles['account-row']}>
                    <div>
                        <strong>이메일</strong>
                        <p>{email || '로그인 정보 없음'}</p>
                    </div>
                    <button type="button" className="btn btn-secondary">변경</button>
                </div>

                <div className={`${styles['account-row']} danger`}>
                    <div>
                        <strong>로그아웃</strong>
                        <p>현재 기기에서 로그아웃합니다.</p>
                    </div>
                    <button type="button" className="btn btn-secondary" onClick={handleLogout}>
                        로그아웃
                    </button>
                </div>
            </div>
        </section>
    );
}

export default MypageAccountSecuritySection;