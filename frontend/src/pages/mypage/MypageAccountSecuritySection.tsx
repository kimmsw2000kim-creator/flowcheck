import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../../api/authApi';
import { deactivateMypageAccount } from '../../api/mypageApi';
import { Button, Card, PageHeader, TextField } from '../../components/common';
import { useAlertStore } from '../../store/alertStore';
import { useUserStore } from '../../store/userStore';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  getPasswordValidationError,
} from '../../utils/authValidation';
import { getKoreanErrorMessage } from '../../utils/errorMessage';
import styles from '../../styles/mypage.module.css';

interface MypageAccountSecuritySectionProps {
  email: string;
  canChangePassword: boolean;
}

function MypageAccountSecuritySection({ email, canChangePassword }: MypageAccountSecuritySectionProps) {
  const navigate = useNavigate();
  const logout = useUserStore((state) => state.logout);
  const showAlert = useAlertStore((state) => state.showAlert);
  const [deactivating, setDeactivating] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const passwordConfirmTouched = newPasswordConfirm.length > 0;
  const passwordMatched = newPassword === newPasswordConfirm;
  const newPasswordError = newPassword.length > 0 ? getPasswordValidationError(newPassword) : undefined;

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
      showAlert(getKoreanErrorMessage(error, '계정을 비활성화하지 못했습니다.'), 'error');
    } finally {
      setDeactivating(false);
    }
  };

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = getPasswordValidationError(newPassword);
    if (validationError) {
      showAlert(validationError, 'error');
      return;
    }
    if (!passwordMatched) {
      showAlert('새 비밀번호가 일치하지 않습니다.', 'error');
      return;
    }
    if (currentPassword === newPassword) {
      showAlert('현재 비밀번호와 다른 새 비밀번호를 입력해 주세요.', 'error');
      return;
    }

    try {
      setChangingPassword(true);
      await changePassword(currentPassword, newPassword);

      // 변경 후 기존 세션을 종료해 새 비밀번호로 다시 본인 인증을 받습니다.
      await logout();
      showAlert('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.', 'success');
      navigate('/login', { replace: true });
    } catch (error: unknown) {
      showAlert(getKoreanErrorMessage(error, '비밀번호를 변경하지 못했습니다.'), 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <section className={styles['mypage-section']}>
      <PageHeader headingLevel={1} eyebrow="ACCOUNT" title="계정 · 보안" description="로그인 계정과 현재 세션을 관리합니다." />
      <div className={styles['account-panel']}>
        <Card className={styles['account-row']}>
          <div><strong>이메일</strong><p>{email || '로그인 정보 없음'}</p></div>
        </Card>
        <Card className={`${styles['account-row']} ${styles['account-password-row']}`} variant="outlined">
          <div className={styles['account-password-copy']}>
            <strong>비밀번호 변경</strong>
            <p>
              {canChangePassword
                ? '현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다.'
                : 'Google 전용 계정은 Google 계정 보안 설정에서 비밀번호를 관리합니다.'}
            </p>
          </div>
          {canChangePassword && (
            <form className={styles['account-password-form']} onSubmit={handlePasswordChange}>
              <TextField
                label="현재 비밀번호"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                disabled={changingPassword}
              />
              <TextField
                label="새 비밀번호"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                error={newPasswordError}
                description={!newPasswordError && newPassword.length > 0 ? '사용 가능한 비밀번호 형식입니다.' : '8자 이상, 영문과 숫자를 포함해 주세요.'}
                required
                disabled={changingPassword}
              />
              <TextField
                label="새 비밀번호 확인"
                type="password"
                autoComplete="new-password"
                value={newPasswordConfirm}
                onChange={(event) => setNewPasswordConfirm(event.target.value)}
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                error={passwordConfirmTouched && !passwordMatched ? '새 비밀번호가 일치하지 않습니다.' : undefined}
                description={passwordConfirmTouched && passwordMatched ? '새 비밀번호가 일치합니다.' : undefined}
                required
                disabled={changingPassword}
              />
              <Button
                type="submit"
                fullWidth
                isLoading={changingPassword}
                loadingText="변경 중..."
                disabled={Boolean(newPasswordError) || !passwordMatched || currentPassword.length === 0}
              >
                비밀번호 변경
              </Button>
            </form>
          )}
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
