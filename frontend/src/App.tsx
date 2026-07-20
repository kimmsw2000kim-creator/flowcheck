import { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';
import AdminRoute from './components/AdminRoute';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Toast from './components/common/Toast';
import Chatbot from './components/Chatbot';

// Pages
import DashboardPage from './pages/DashboardPage';
import DomainsPage from './pages/DomainsPage';
import UIUXTestPage from './pages/UIUXTestPage';
import LoadPage from './pages/LoadPage';
import PaymentPage from './pages/PaymentPage';
import PostWritePage from "./pages/PostWritePage";
import PostEditPage from "./pages/PostEditPage";
import AdminPage from './pages/admin/AdminPage';
import SupportPage from './pages/SupportPage';
import Mypage from './pages/Mypage';
import AuthPage from './pages/AuthPage';
import AuthCallback from './pages/AuthCallback';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import LandingPage from './pages/LandingPage';
import CommentPage from "./pages/CommentPage";
import CommunityHubPage from './pages/community/CommunityHubPage';
import CommunityPostDetailPage from './pages/community/CommunityPostDetailPage';
import './styles/CommunityPages.css';
import './components/uiux/UIUXTestModule.css';
import './styles/AppShell.css';
import './styles/UtilityPages.css';

// Types & Utils
import { useUserStore } from './store/userStore';
import { useAlertStore } from './store/alertStore';
import { useSessionBootstrap } from './hooks/useSessionBootstrap';

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
  useSessionBootstrap();

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
  };

  // Supports sub-paths for active tab checking (e.g., /community/write)
  const activeTab = location.pathname.startsWith('/comment')
    ? 'community'
    : (Object.entries(tabRoutes).find(([, path]) =>
      location.pathname === path || location.pathname.startsWith(`${path}/`)
    )?.[0] ?? 'dashboard');

  const setActiveTab = (tab: string) => {
    navigate(tabRoutes[tab] ?? '/dashboard');
  };

  const currentUser = useUserStore((state) => state.currentUser);
  const authStatus = useUserStore((state) => state.authStatus);
  const alertMsg = useAlertStore((state) => state.alertMsg);
  const showAlert = useAlertStore((state) => state.showAlert);

  const [, setReports] = useState<Report[]>([]);

  const isLoggedIn = authStatus === 'authenticated';
  const isLandingPage = !isLoggedIn && location.pathname === '/';
  const isPasswordResetPage = location.pathname === '/reset-password';
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | null>(null);

  const [selectedUIUXTestDomain, setSelectedUIUXTestDomain] = useState<number>(1);
  const [selectedLoadTestDomain, setSelectedLoadTestDomain] = useState<number>(0);

  const handleSubmitReport = (type: string, id: number) => {
    const report: Report = {
      id: Date.now(),
      reporterId: currentUser.id,
      targetType: type,
      targetId: id,
      reason: "부적절한 내용",
      status: "PENDING",
      createdAt: new Date().toISOString().split("T")[0],
    };

    setReports((prev) => [...prev, report]);
    showAlert("신고가 접수되었습니다.");
  };

  if (authStatus === 'checking' && !isPasswordResetPage) {
    return (
      <div className="app-container">
        {alertMsg && <Toast message={alertMsg.message} type={alertMsg.type} />}
        <main className="main-content">
          <div className="app-loading-state" role="status" aria-live="polite">
            앱을 불러오는 중입니다.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      {alertMsg && <Toast message={alertMsg.message} type={alertMsg.type} />}

      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <Header
        activeTab={activeTab}
        onOpenAuth={(mode) => {
          // 랜딩페이지에서는 주소를 바꾸지 않고 인증 모달을 엽니다.
          if (isLandingPage) {
            setAuthModalMode(mode);
            return;
          }
          navigate(`/${mode}`);
        }}
      />

      {isLandingPage && authModalMode && (
        <AuthModal
          initialMode={authModalMode}
          onClose={() => setAuthModalMode(null)}
          setActiveTab={setActiveTab}
        />
      )}

      <main id="main-content" className={isLandingPage ? "landing-main" : "main-content"}>
        <Routes>
          {/* 복구 링크는 Supabase 세션을 만들기 때문에 로그인 판정과 관계없이 접근 가능해야 합니다. */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />
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
                    setSelectedLoadTestDomain={setSelectedLoadTestDomain}
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
                  />
                }
              />

              <Route
                path="/load"
                element={
                  <LoadPage
                    selectedLoadTestDomain={selectedLoadTestDomain}
                    setSelectedLoadTestDomain={setSelectedLoadTestDomain}
                  />
                }
              />

              <Route
                path="/billing"
                element={<PaymentPage />}
              />

              {/* 새 커뮤니티 허브를 실제 커뮤니티 주소로 사용합니다. */}
              <Route
                path="/community"
                element={
                  <CommunityHubPage
                    currentUser={currentUser}
                    showAlert={showAlert}
                  />
                }
              />

              {/* 기존 미리보기 주소로 접근하면 실제 커뮤니티로 이동합니다. */}
              <Route
                path="/community-preview"
                element={
                  <Navigate
                    to="/community"
                    replace
                  />
                }
              />

              {/* 과거 커뮤니티 작성 주소는 새 커뮤니티로 이동시킵니다. */}
              <Route
                path="/community/write"
                element={<Navigate to="/community" replace />}
              />

              {/* 새 community_posts 테이블을 사용하는 상세 페이지입니다. */}
              <Route
                path="/community/:postId"
                element={<CommunityPostDetailPage />}
              />

              {/* 수정은 상세 화면의 모달을 사용합니다. */}
              <Route
                path="/community/:postId/edit"
                element={<Navigate to="/community" replace />}
              />

              {/* 자유게시판 로직은 유지하고 작성·수정 주소만 커뮤니티 하위로 제공합니다. */}
              <Route
                path="/community/free/write"
                element={<PostWritePage />}
              />

              <Route
                path="/community/free/:postId/edit"
                element={<PostEditPage />}
              />

              {/* 자유게시판 작성과 수정 경로는 그대로 유지합니다. */}
              <Route
                path="/comment/write"
                element={<PostWritePage />}
              />

              <Route
                path="/comment/:postId/edit"
                element={<PostEditPage />}
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
                  <AdminRoute>
                    <AdminPage />
                  </AdminRoute>
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
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </main>

      {isLandingPage && <Footer variant="full" />}
      {isLoggedIn && <Footer variant="compact" />}
      <Chatbot />
    </div>
  );
}

export default App;
