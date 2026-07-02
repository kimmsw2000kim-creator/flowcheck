import { CreditCard, Globe, Ticket, Activity } from 'lucide-react';

import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { MypageData } from '../types/mypage';
import { getAccessToken } from '../api/sessionApi';
import { fetchMypage } from '../api/mypageApi';

import MypageStatCard from '../components/MypageStatCard';
import MypageSidebar from '../components/MypageSidebar';
import flowCheckLogo from '../assets/flowcheck.png';
import MypageSiteList from "../components/MypageSiteList.tsx";

interface SiteSummary {
    siteId: number;
    serviceName: string;
    domainURL: string;
    isVerified: boolean;
    createdAt: string;
}


const mockData: MypageData = {
    email: 'user@flowcheck.com',
    balance: 1200,
    couponCount: 3,
    registeredSiteCount: 2,
    testRunCount: 12,
    sites: [
        {
            siteId: 1,
            serviceName: 'myshop',
            domainUrl: 'https://myshop.com',
            isVerified: true,
            createdAt: '2026-07-01T10:00:00',
        },
        {
            siteId: 2,
            serviceName: 'blogexample',
            domainUrl: 'https://blogexample.com',
            isVerified: false,
            createdAt: '2026-07-01T11:00:00',
        },
    ],
};

function Mypage() {
    const [data] = useState<MypageData>(mockData);

    return (
        <div className="mypage-layout">
            <MypageSidebar />

           <main className="mypage-main">
  <Routes>
    <Route path="/" element={<Navigate to="profile" replace />} />

    <Route
      path="profile"
      element={
        <>
          <section className="mypage-header">
            <div>
              <h1>마이페이지</h1>
              <p>{data.email}</p>
            </div>
          </section>

          <section className="mypage-stats">
            {/* 기존 StatCard들 */}
          </section>
        </>
      }
    />

    <Route path="sites" element={<MypageSiteList sites={data.sites} />} />
    <Route path="tests" element={<div>테스트 이력</div>} />
    <Route path="points" element={<div>이용권 · 포인트</div>} />
    <Route path="point-history" element={<div>포인트 내역</div>} />
    <Route path="payments" element={<div>결제 내역</div>} />
    <Route path="posts" element={<div>내 글 · 리뷰</div>} />
    <Route path="notifications" element={<div>알림 설정</div>} />
    <Route path="theme" element={<div>테마 설정</div>} />
    <Route path="security" element={<div>계정 · 보안</div>} />
  </Routes>
</main>


        </div>
    );
}

export default Mypage;