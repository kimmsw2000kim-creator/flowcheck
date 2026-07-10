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
import MypagePointSection from './mypage/MypagePointSection';
import MypagePointHistorySection from './mypage/MypagePointHistorySection';
import MypageMyPostsSection from './mypage/MypageMyPostsSection';
import MypageNotificationSettingsSection from './mypage/MypageNotificationSettingsSection';
import MypageThemeSettingsSection from './mypage/MypageThemeSettingsSection';
import MypageAccountSecuritySection from './mypage/MypageAccountSecuritySection';
import MypageTestDetailSection from './mypage/MypageTestDetailSection';

import { getAccessToken, getCurrentEmail } from '../api/authApi';
import { fetchMypage } from '../api/mypageApi';
import MypageCouponHistorySection from './mypage/MypageCouponHistorySection';

const emptyData: MypageData = {
  email: '',
  balance: 0,
  couponCount: 0,
  loadTestCouponCount: 0,
  uiUxTestCouponCount: 0,
  registeredSiteCount: 0,
  testRunCount: 0,
  sites: [],
};

function Mypage() {
  const navigate = useNavigate();

  const [data, setData] = useState<MypageData>({
    ...emptyData,
    email: getCurrentEmail() ?? '',
  });

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const accessToken = getAccessToken();

    if (!accessToken) {
      setErrorMessage('로그인이 필요합니다.');
      setLoading(false);
      return;
    }

    fetchMypage()
      .then((mypageData) => {
        setData(mypageData);
      })
      .catch(() => {
        setErrorMessage('마이페이지 정보를 불러오지 못했습니다.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className={styles['mypage-layout']}>
      <MypageSidebar />

      <main className={styles['mypage-main']}>
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
              element={<MypageProfileSection data={data} />}
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

            <Route
              path="points"
              element={<MypagePointSection data={data} />}
            />

            <Route
              path="point-history"
              element={<MypagePointHistorySection />}
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
              path="notifications"
              element={<MypageNotificationSettingsSection />}
            />

            <Route
              path="theme"
              element={<MypageThemeSettingsSection />}
            />

            <Route
              path="security"
              element={<MypageAccountSecuritySection email={data.email} />}
            />

            <Route path="*" element={<Navigate to="profile" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}

export default Mypage;