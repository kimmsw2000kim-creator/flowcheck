import { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
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
import LandingPage from './pages/LandingPage';
import CommentPage from "./pages/CommentPage";
import CommunityHubPage from './pages/community/CommunityHubPage';
import CommunityPostDetailPage from './pages/community/CommunityPostDetailPage';

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
  const alertMsg = useAlertStore((state) => state.alertMsg);
  const showAlert = useAlertStore((state) => state.showAlert);

  const [, setReports] = useState<Report[]>([]);

  const isLoggedIn = authStatus === 'authenticated';
  const isLandingPage = !isLoggedIn && location.pathname === '/';

  const [selectedUIUXTestDomain, setSelectedUIUXTestDomain] = useState<number>(1);

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

      <Header activeTab={activeTab} />

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
                  />
                }
              />

              <Route
                path="/load"
                element={<LoadPage />}
              />

              <Route
                path="/billing"
                element={<PaymentPage />}
              />

              {/* 새 커뮤니티 허브를 실제 커뮤니티 주소로 사용합니다. */}
              <Route
                path="/community"
                element={<CommunityHubPage />}
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
                  <AdminPage />
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
      <Chatbot />
    </div>
  );
}

export default App;
