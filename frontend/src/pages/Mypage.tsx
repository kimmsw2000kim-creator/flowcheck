import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

import type { MypageData } from '../types/mypage';
import MypageSidebar from '../components/MypageSidebar';
import MypageSiteList from '../components/MypageSiteList';
import MypageProfileSection from './mypage/MypageProfileSection';

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
      <MypageSidebar data={data} />

      <main className="mypage-main">
        {loading && <div>마이페이지 정보를 불러오는 중입니다.</div>}
        {errorMessage && <div>{errorMessage}</div>}

        {!loading && !errorMessage && (
          <Routes>
            <Route path="/" element={<Navigate to="profile" replace />} />

            <Route
  path="profile"
  element={<MypageProfileSection data={data} />}
/>

            <Route path="sites" element={<MypageSiteList sites={data.sites} />} />
            <Route path="tests" element={<div>테스트 이력: {data.testRunCount}건</div>} />
            <Route path="points" element={<div>포인트: {data.balance.toLocaleString()}P</div>} />
            <Route path="point-history" element={<div>포인트 내역</div>} />
            <Route path="payments" element={<div>결제 내역</div>} />
            <Route path="posts" element={<div>내 글 · 리뷰</div>} />
            <Route path="notifications" element={<div>알림 설정</div>} />
            <Route path="theme" element={<div>테마 설정</div>} />
            <Route path="security" element={<div>계정 · 보안</div>} />
          </Routes>
        )}
      </main>
    </div>
  );
}

export default Mypage;