import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Activity, CreditCard, Globe, ImagePlus, Ticket, Trash2 } from 'lucide-react';
import { removeProfileImage, uploadProfileImage } from '../../api/profileApi';
import { updateMypageNickname } from '../../api/mypageApi';
import MypageStatCard from '../../components/MypageStatCard';
import MypageSiteList from '../../components/MypageSiteList';
import { Button, Card, PageHeader, TextField } from '../../components/common';
import { useAlertStore } from '../../store/alertStore';
import type { MypageData } from '../../types/mypage';
import {
  NICKNAME_MAX_LENGTH,
  getNicknameValidationError,
  normalizeNickname,
} from '../../utils/authValidation';
import styles from '../../styles/mypage.module.css';

interface MypageProfileSectionProps {
  data: MypageData;
  onAvatarChange: (avatarUrl: string) => void;
  onNicknameChange: (nickname: string) => void;
}

function MypageProfileSection({ data, onAvatarChange, onNicknameChange }: MypageProfileSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAction, setPendingAction] = useState<'upload' | 'remove' | 'nickname' | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState(data.nickname ?? '');
  const showAlert = useAlertStore((state) => state.showAlert);
  const nicknameValidationError = nicknameDraft.length > 0
    ? getNicknameValidationError(nicknameDraft)
    : undefined;
  const avatarLabel = (data.nickname || data.email).charAt(0).toUpperCase() || 'F';

  useEffect(() => {
    setNicknameDraft(data.nickname ?? '');
  }, [data.nickname]);

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setPendingAction('upload');
    try {
      const avatarUrl = await uploadProfileImage(file);
      onAvatarChange(avatarUrl);
      showAlert('프로필 사진이 변경되었습니다.', 'success');
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '프로필 사진을 변경하지 못했습니다.', 'error');
    } finally {
      setPendingAction(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setPendingAction('remove');
    try {
      await removeProfileImage();
      onAvatarChange('');
      showAlert('프로필 사진이 삭제되었습니다.', 'success');
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '프로필 사진을 삭제하지 못했습니다.', 'error');
    } finally {
      setPendingAction(null);
    }
  };

  const handleNicknameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = getNicknameValidationError(nicknameDraft);
    if (validationError) {
      showAlert(validationError, 'error');
      return;
    }

    const normalizedNickname = normalizeNickname(nicknameDraft);
    if (normalizedNickname === data.nickname) return;

    setPendingAction('nickname');
    try {
      const savedNickname = await updateMypageNickname(normalizedNickname);
      onNicknameChange(savedNickname);
      setNicknameDraft(savedNickname);
      showAlert('닉네임이 변경되었습니다.', 'success');
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '닉네임을 변경하지 못했습니다.', 'error');
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <section className={styles['mypage-section']}>
      <Card className={styles['mypage-profile-card']} variant="subtle">
        <div className={styles['profile-avatar-editor']}>
          <div className={styles['profile-avatar']} aria-label={`${data.nickname || data.email} 프로필 사진`}>
            <span aria-hidden="true">{avatarLabel}</span>
            {data.avatarUrl && (
              <img
                src={data.avatarUrl}
                alt=""
                onError={(event) => { event.currentTarget.hidden = true; }}
              />
            )}
          </div>
          <div className={styles['profile-avatar-actions']}>
            <input
              ref={fileInputRef}
              className={styles['profile-avatar-input']}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={pendingAction !== null}
              onChange={(event) => { void handleFileChange(event.target.files?.[0]); }}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={ImagePlus}
              isLoading={pendingAction === 'upload'}
              loadingText="업로드 중..."
              disabled={pendingAction !== null}
              onClick={() => fileInputRef.current?.click()}
            >
              사진 변경
            </Button>
            {data.avatarUrl && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={Trash2}
                isLoading={pendingAction === 'remove'}
                loadingText="삭제 중..."
                disabled={pendingAction !== null}
                onClick={() => { void handleRemove(); }}
              >
                삭제
              </Button>
            )}
            <small>JPG, PNG, WebP, GIF · 최대 5MB</small>
          </div>
        </div>
        <div className={styles['profile-identity']}>
          <PageHeader
            headingLevel={1}
            eyebrow="MY FLOWCHECK"
            title={data.nickname || '마이페이지'}
            description={data.email}
          />
          <form className={styles['profile-nickname-form']} onSubmit={handleNicknameSubmit}>
            <TextField
              label="닉네임"
              type="text"
              autoComplete="nickname"
              value={nicknameDraft}
              onChange={(event) => setNicknameDraft(event.target.value)}
              maxLength={NICKNAME_MAX_LENGTH}
              error={nicknameValidationError}
              description={!nicknameValidationError && nicknameDraft.length > 0
                ? '사용 가능한 형식입니다.'
                : '2~20자의 한글, 영문, 숫자, 밑줄을 사용할 수 있습니다.'}
              required
              disabled={pendingAction !== null}
            />
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              isLoading={pendingAction === 'nickname'}
              loadingText="저장 중..."
              disabled={pendingAction !== null
                || normalizeNickname(nicknameDraft).length === 0
                || Boolean(nicknameValidationError)
                || normalizeNickname(nicknameDraft) === (data.nickname ?? '')}
            >
              닉네임 저장
            </Button>
          </form>
        </div>
      </Card>

      <div className={styles['mypage-stats']} aria-label="사용 현황">
        <MypageStatCard icon={CreditCard} label="포인트" value={`${data.balance.toLocaleString()}P`} />
        <MypageStatCard
          icon={Ticket}
          label="쿠폰"
          value={<><span>부하 {data.loadTestCouponCount}회</span><span>UI/UX {data.UIUXTestCouponCount}회</span></>}
        />
        <MypageStatCard icon={Globe} label="인증 사이트" value={`${data.registeredSiteCount}개`} />
        <MypageStatCard icon={Activity} label="총 테스트" value={`${data.testRunCount}회`} />
      </div>

      <PageHeader headingLevel={2} title="등록 사이트" description="현재 계정에 등록된 서비스와 인증 상태입니다." />
      <MypageSiteList sites={data.sites} />
    </section>
  );
}

export default MypageProfileSection;
