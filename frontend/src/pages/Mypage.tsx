import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import styles from '../styles/mypage.module.css';

import type { MypageData } from '../types/mypage';

import MypageSidebar from '../components/MypageSidebar';
import EmptyState from '../components/common/EmptyState';
import Button from '../components/common/Button';

import MypageProfileSection from './mypage/MypageProfileSection';
import MypageVerifiedSitesSection from './mypage/MypageVerifiedSitesSection';
import MypageTestHistorySection from './mypage/MypageTestHistorySection';
import MypageCreditHistorySection from './mypage/MypageCreditHistorySection';
import MypageCouponHistorySection from './mypage/MypageCouponHistorySection';
import MypageMyPostsSection from './mypage/MypageMyPostsSection';
import MypageTestDetailSection from './mypage/MypageTestDetailSection';
import MypageAccountSecuritySection from './mypage/MypageAccountSecuritySection';

import { fetchMypage } from '../api/mypageApi';
import { getProfileImageUrl } from '../api/profileApi';
import { supabase } from '../lib/supabaseClient';
import { useUserStore } from '../store/userStore';

const emptyData: MypageData = {
  email: '',
  nickname: '',
  avatarUrl: '',
  balance: 0,
  couponCount: 0,
  loadTestCouponCount: 0,
  UIUXTestCouponCount: 0,
  registeredSiteCount: 0,
  testRunCount: 0,
  sites: [],
};

function Mypage() {
  const navigate = useNavigate();
  const setCurrentUser = useUserStore((state) => state.setCurrentUser);

  const [data, setData] = useState<MypageData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [canChangePassword, setCanChangePassword] = useState(false);

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
          setErrorMessage('로그인이 필요합니다.');
          return;
        }

        const userEmail = session.user.email || '';

        // 연결된 인증 수단 중 email이 있을 때만 현재 비밀번호 변경 폼을 제공합니다.
        // Google 전용 계정은 공급자 계정에서 비밀번호를 관리합니다.
        const metadataProviders = Array.isArray(session.user.app_metadata?.providers)
          ? session.user.app_metadata.providers
          : [];
        setCanChangePassword(
          session.user.identities?.some((identity) => identity.provider === 'email')
          || metadataProviders.includes('email')
          || session.user.app_metadata?.provider === 'email',
        );

        const mypageData = await fetchMypage();

        setData({
          ...mypageData,
          email: userEmail,
          nickname: mypageData.nickname
            || (typeof session.user.user_metadata?.nickname === 'string'
              ? session.user.user_metadata.nickname
              : ''),
          avatarUrl: mypageData.avatarUrl || getProfileImageUrl(session.user.user_metadata),
        });

      } catch {
        setErrorMessage('마이페이지 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndFetch();
  }, []);

  const handleAvatarChange = (avatarUrl: string) => {
    setData((current) => ({ ...current, avatarUrl }));
    setCurrentUser({ avatarUrl });
  };

  const handleNicknameChange = (nickname: string) => {
    setData((current) => ({ ...current, nickname }));
    setCurrentUser({ nickname });
  };

  return (
    <div className={styles['mypage-layout']}>
      <MypageSidebar />

      <div className={styles['mypage-main']}>
        {loading && (
          <EmptyState
            title="마이페이지 정보를 불러오는 중입니다."
            description="잠시만 기다려 주세요."
          />
        )}

        {!loading && errorMessage && (
          <EmptyState
            title={errorMessage}
            description="로그인 후 다시 마이페이지를 확인할 수 있습니다."
            actionButton={
              <Button onClick={() => navigate('/login')}>
                로그인하러 가기
              </Button>
            }
          />
        )}

        {!loading && !errorMessage && (
          <Routes>
            <Route path="/" element={<Navigate to="profile" replace />} />

            <Route
              path="profile"
              element={(
                <MypageProfileSection
                  data={data}
                  onAvatarChange={handleAvatarChange}
                  onNicknameChange={handleNicknameChange}
                />
              )}
            />

            <Route
              path="sites"
              element={<MypageVerifiedSitesSection sites={data.sites} />}
            />

            <Route
              path="tests"
              element={<MypageTestHistorySection />}
            />

            <Route
              path="tests/:testType/:requestId"
              element={<MypageTestDetailSection />}
            />

            {/* 쿠폰·포인트 종합 화면은 숨기고, 사용 내역 화면만 유지합니다. */}
            <Route
              path="credit-history"
              element={<MypageCreditHistorySection />}
            />

            <Route
              path="coupon-history"
              element={<MypageCouponHistorySection />}
            />

            <Route
              path="posts"
              element={<MypageMyPostsSection />}
            />

            <Route
              path="account"
              element={(
                <MypageAccountSecuritySection
                  email={data.email}
                  canChangePassword={canChangePassword}
                />
              )}
            />

            <Route path="*" element={<Navigate to="profile" replace />} />
          </Routes>
        )}
      </div>
    </div>
  );
}

export default Mypage;
