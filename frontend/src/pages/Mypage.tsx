import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import '../styles/mypage.css';

import type { MypageData } from '../types/mypage';

import MypageSidebar from '../components/MypageSidebar';

import MypageProfileSection from './mypage/MypageProfileSection';
import MypageVerifiedSitesSection from './mypage/MypageVerifiedSitesSection';
import MypageTestHistorySection from './mypage/MypageTestHistorySection';
import MypagePointSection from './mypage/MypagePointSection';
import MypagePointHistorySection from './mypage/MypagePointHistorySection';
import MypagePaymentHistorySection from './mypage/MypagePaymentHistorySection';
import MypageMyPostsSection from './mypage/MypageMyPostsSection';
import MypageNotificationSettingsSection from './mypage/MypageNotificationSettingsSection';
import MypageThemeSettingsSection from './mypage/MypageThemeSettingsSection';
import MypageAccountSecuritySection from './mypage/MypageAccountSecuritySection';

import { getAccessToken, getCurrentEmail } from '../api/authApi';
import { fetchMypage } from '../api/mypageApi';

const emptyData: MypageData = {
  email: '',
  balance: 0,
  couponCount: 0,
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

    fetchMypage(accessToken)
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
    <div className="mypage-layout">
      <MypageSidebar />

      <main className="mypage-main">
        {loading && (
          <div className="empty-state">
            <strong>마이페이지 정보를 불러오는 중입니다.</strong>
            <p>잠시만 기다려 주세요.</p>
          </div>
        )}

        {!loading && errorMessage && (
          <div className="empty-state">
            <strong>{errorMessage}</strong>
            <p>로그인 후 다시 마이페이지를 확인할 수 있습니다.</p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/login')}
            >
              로그인하러 가기
            </button>
          </div>
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
              path="points"
              element={<MypagePointSection data={data} />}
            />

            <Route
              path="point-history"
              element={<MypagePointHistorySection />}
            />

            <Route
              path="payments"
              element={<MypagePaymentHistorySection />}
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