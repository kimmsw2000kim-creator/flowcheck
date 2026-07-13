import { useState, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import Header from './components/Header';
import Footer from './components/Footer';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Toast from './components/common/Toast';

// Pages
import DashboardPage from './pages/DashboardPage';
import DomainsPage from './pages/DomainsPage';
import UIUXTestPage from './pages/UIUXTestPage';
import LoadPage from './pages/LoadPage';
import PaymentPage from './pages/PaymentPage';
import CommunityPage from './pages/CommunityPage';
import PostWritePage from "./pages/PostWritePage";
import PostDetailPage from "./pages/PostDetailPage";
import PostEditPage from "./pages/PostEditPage";
import AdminPage from './pages/admin/AdminPage';
import SupportPage from './pages/SupportPage';
import Mypage from './pages/Mypage';
import AuthPage from './pages/AuthPage';
import AuthCallback from './pages/AuthCallback';
import LandingPage from './pages/LandingPage';
import CommentPage from "./pages/CommentPage";

// Types & Utils
import { useUserStore } from './store/userStore';
import { useAlertStore } from './store/alertStore';
import apiClient from './api/client';
import { supabase } from './lib/supabaseClient';

interface LedgerItem {
  id: number;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

// 신고
interface Report {
  id: number;
  reporterId: string;
  targetType: string;
  targetId: number;
  reason: string;
  status: string;
  createdAt: string;
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // 라우팅
  const tabRoutes: Record<string, string> = {
    dashboard: '/dashboard',
    mypage: '/mypage',
    domains: '/domains',
    UIUXTest: '/UIUXTest',
    load: '/load',
    billing: '/billing',
    community: '/community',
    admin: '/admin',
    support: '/support',
    login: '/login',
    signup: '/signup',
    comment: "/comment",
  };

  // Supports sub-paths for active tab checking (e.g., /community/write)
  const activeTab =
    Object.entries(tabRoutes).find(([, path]) =>
      location.pathname === path || location.pathname.startsWith(`${path}/`)
    )?.[0] ?? 'dashboard';

  const setActiveTab = (tab: string) => {
    navigate(tabRoutes[tab] ?? '/dashboard');
  };

  const currentUser = useUserStore((state) => state.currentUser);
  const authStatus = useUserStore((state) => state.authStatus);
  const setAuthStatus = useUserStore((state) => state.setAuthStatus);
  const setCurrentUser = useUserStore((state) => state.setCurrentUser);
  const resetAuthState = useUserStore((state) => state.resetAuthState);
  const alertMsg = useAlertStore((state) => state.alertMsg);
  const showAlert = useAlertStore((state) => state.showAlert);

  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const lastSessionTokenRef = useRef<string | null | undefined>(undefined);

  const isLoggedIn = authStatus === 'authenticated';
  const isLandingPage = !isLoggedIn && location.pathname === '/';

  // 유저 정보와 결제 내역 불러오기
  useEffect(() => {
    let isMounted = true;

    const applySession = async (session: Session | null) => {
      const sessionToken = session?.access_token ?? null;
      if (lastSessionTokenRef.current === sessionToken) return;
      lastSessionTokenRef.current = sessionToken;

      if (!session) {
        setLedger([]);
        resetAuthState();
        return;
      }

      const sessionUser = session.user;
      const authConfig = {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      };

      setCurrentUser({
        id: sessionUser.id,
        email: sessionUser.email ?? '',
      });
      setAuthStatus('authenticated');

      try {
        const res = await apiClient.get('/api/mypage', authConfig);
        if (!isMounted) return;

        const data = res.data;
        setCurrentUser({
          id: sessionUser.id,
          email: data.email ?? sessionUser.email ?? '',
          role: data.role,
          status: data.status,
          balance: data.balance,
          coupons: data.couponCount,
          loadTestCoupons: data.loadTestCouponCount,
          UIUXTestCoupons: data.UIUXTestCouponCount,
        });
      } catch (err) {
        console.error("Failed to load user profile session:", err);
        return;
      }

      try {
        const res = await apiClient.get('/api/payment/ledger', authConfig);
        if (!isMounted) return;
        setLedger(res.data);
      } catch (err) {
        console.error("Failed to load ledger history:", err);
      }
    };

    setAuthStatus('checking');

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return;

      if (error) {
        console.error("Failed to check Supabase session:", error);
        applySession(null);
        return;
      }

      applySession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        if (!isMounted) return;
        applySession(session);
      }, 0);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [resetAuthState, setAuthStatus, setCurrentUser]);

  const [selectedUIUXTestDomain, setSelectedUIUXTestDomain] = useState<number>(1);

  const handleAddLedger = (ledgerItem: LedgerItem) => {
    setLedger(prev => [ledgerItem, ...prev]);
  };

  const handleSubmitReport = (type: string, id: number) => {
    const report: Report = {
      id: reports.length + 1,
      reporterId: currentUser.id,
      targetType: type,
      targetId: id,
      reason: '부적절한 내용',
      status: 'PENDING',
      createdAt: new Date().toISOString().split('T')[0]
    };
    setReports([...reports, report]);
    showAlert('신고가 접수되었습니다.');
  };

  if (authStatus === 'checking') {
    return (
      <div className="app-container">
        {alertMsg && <Toast message={alertMsg.message} type={alertMsg.type} />}
        <main className="main-content">
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
            Loading...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      {alertMsg && <Toast message={alertMsg.message} type={alertMsg.type} />}

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className={isLandingPage ? "landing-main" : "main-content"}>
        <Routes>
          {isLoggedIn ? (
            <>
              {/* 로그인 상태인 경우 대시보드로 이동 */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<Navigate to="/dashboard" replace />} />
              <Route path="/signup" element={<Navigate to="/dashboard" replace />} />

              <Route
                path="/dashboard"
                element={
                  <DashboardPage
                    setActiveTab={setActiveTab}
                    setSelectedUIUXTestDomain={setSelectedUIUXTestDomain}
                  />
                }
              />

              <Route path="/mypage/*" element={<Mypage />} />

              <Route
                path="/domains"
                element={
                  <DomainsPage />
                }
              />

              <Route
                path="/UIUXTest"
                element={
                  <UIUXTestPage
                    selectedUIUXTestDomain={selectedUIUXTestDomain}
                    setSelectedUIUXTestDomain={setSelectedUIUXTestDomain}
                    onAddLedger={handleAddLedger}
                  />
                }
              />

              <Route
                path="/load"
                element={
                  <LoadPage
                    onAddLedger={handleAddLedger}
                  />
                }
              />

              <Route
                path="/billing"
                element={
                  <PaymentPage
                    ledger={ledger}
                    onAddLedger={handleAddLedger}
                  />
                }
              />

              {/* Community Tab Sub-routing System */}
              <Route
                path="/community"
                element={
                  <CommunityPage
                    ledger={ledger}
                    onAddLedger={handleAddLedger}
                    handleSubmitReport={handleSubmitReport}
                  />
                }
              />
              <Route path="/community/write" element={<PostWritePage />} />
              <Route path="/comment/write" element={<PostWritePage />} />
              <Route path="/community/:postId" element={<PostDetailPage />} />
              <Route path="/community/:postId/edit" element={<PostEditPage />} />
              <Route path="/comment/:postId/edit" element={<PostEditPage />}
              />

              <Route
                path="/comment"
                element={
                  <CommentPage
                    currentUser={currentUser}
                    showAlert={showAlert}
                  />
                }
              />

              <Route
                path="/admin"
                element={
                  <AdminPage currentUser={currentUser} />
                }
              />

              <Route path="/support" element={<SupportPage />} />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </>
          ) : (
            <>
              {/* Unauthenticated Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route
                path="/login"
                element={
                  <AuthPage
                    setActiveTab={setActiveTab}
                    initialMode="login"
                  />
                }
              />
              <Route
                path="/signup"
                element={
                  <AuthPage
                    setActiveTab={setActiveTab}
                    initialMode="signup"
                  />
                }
              />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </main>

      {isLoggedIn && <Footer />}
    </div>
  );
}

export default App;
