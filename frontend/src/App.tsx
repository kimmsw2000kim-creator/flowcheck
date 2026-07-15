import { useState } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import Header from './components/Header';
import Footer from './components/Footer';
import Chatbot from './components/Chatbot';
import Toast from './components/common/Toast';

// Pages
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import AuthCallback from './pages/AuthCallback';
import DashboardPage from './pages/DashboardPage';
import DomainsPage from './pages/DomainsPage';
import UIUXTestPage from './pages/UIUXTestPage';
import LoadPage from './pages/LoadPage';
import PaymentPage from './pages/PaymentPage';
import CommunityPage from './pages/CommunityPage';
import PostWritePage from './pages/PostWritePage';
import PostDetailPage from './pages/PostDetailPage';
import PostEditPage from './pages/PostEditPage';
import CommentPage from './pages/CommentPage';
import SupportPage from './pages/SupportPage';
import Mypage from './pages/Mypage';
import AdminPage from './pages/admin/AdminPage';

// Stores & Hooks
import { useUserStore } from './store/userStore';
import { useAlertStore } from './store/alertStore';
import { useSessionBootstrap } from './hooks/useSessionBootstrap';

interface Report {
  id: number;
  reporterId: string;
  targetType: string;
  targetId: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

const TAB_ROUTES: Record<string, string> = {
  dashboard: '/dashboard',
  mypage: '/mypage',
  domains: '/domains',
  UIUXTest: '/UIUXTest',
  load: '/load',
  billing: '/billing',
  community: '/community',
  comment: '/comment',
  admin: '/admin',
  support: '/support',
  login: '/login',
  signup: '/signup',
};

function App() {
  useSessionBootstrap();

  const navigate = useNavigate();
  const location = useLocation();

  const currentUser = useUserStore((state) => state.currentUser);
  const authStatus = useUserStore((state) => state.authStatus);

  const alertMsg = useAlertStore((state) => state.alertMsg);
  const showAlert = useAlertStore((state) => state.showAlert);

  const [, setReports] = useState<Report[]>([]);
  const [selectedUIUXTestDomain, setSelectedUIUXTestDomain] =
    useState<number>(1);

  const isLoggedIn =
    authStatus === 'authenticated' && currentUser !== null;

  const isLandingPage =
    !isLoggedIn && location.pathname === '/';

  const activeTab =
    Object.entries(TAB_ROUTES).find(([, path]) => {
      return (
        location.pathname === path ||
        location.pathname.startsWith(`${path}/`)
      );
    })?.[0] ?? 'dashboard';

  const setActiveTab = (tab: string) => {
    navigate(TAB_ROUTES[tab] ?? '/dashboard');
  };

  const handleSubmitReport = (type: string, id: number) => {
    if (!currentUser) {
      showAlert('로그인이 필요합니다.');
      return;
    }

    const report: Report = {
      id: Date.now(),
      reporterId: currentUser.id,
      targetType: type,
      targetId: id,
      reason: '부적절한 내용',
      status: 'PENDING',
      createdAt: new Date().toISOString().split('T')[0],
    };

    setReports((previousReports) => [
      ...previousReports,
      report,
    ]);

    showAlert('신고가 접수되었습니다.');
  };

  if (authStatus === 'checking') {
    return (
      <div className="app-container">
        {alertMsg && (
          <Toast
            message={alertMsg.message}
            type={alertMsg.type}
          />
        )}

        <main className="main-content">
          <div
            style={{
              padding: '4rem 0',
              textAlign: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            Loading...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      {alertMsg && (
        <Toast
          message={alertMsg.message}
          type={alertMsg.type}
        />
      )}

      <Header activeTab={activeTab} />

      <main
        className={
          isLandingPage ? 'landing-main' : 'main-content'
        }
      >
        <Routes>
          {isLoggedIn ? (
            <>
              {/* 로그인 상태 접근 경로 */}
              <Route
                path="/"
                element={
                  <Navigate to="/dashboard" replace />
                }
              />

              <Route
                path="/login"
                element={
                  <Navigate to="/dashboard" replace />
                }
              />

              <Route
                path="/signup"
                element={
                  <Navigate to="/dashboard" replace />
                }
              />

              {/* 대시보드 */}
              <Route
                path="/dashboard"
                element={
                  <DashboardPage
                    setActiveTab={setActiveTab}
                    setSelectedUIUXTestDomain={
                      setSelectedUIUXTestDomain
                    }
                  />
                }
              />

              {/* 마이페이지 */}
              <Route
                path="/mypage/*"
                element={<Mypage />}
              />

              {/* 도메인 */}
              <Route
                path="/domains"
                element={<DomainsPage />}
              />

              {/* UI/UX 테스트 */}
              <Route
                path="/UIUXTest"
                element={
                  <UIUXTestPage
                    selectedUIUXTestDomain={
                      selectedUIUXTestDomain
                    }
                    setSelectedUIUXTestDomain={
                      setSelectedUIUXTestDomain
                    }
                  />
                }
              />

              {/* 부하 테스트 */}
              <Route
                path="/load"
                element={<LoadPage />}
              />

              {/* 결제 */}
              <Route
                path="/billing"
                element={<PaymentPage />}
              />

              {/* 커뮤니티 */}
              <Route
                path="/community"
                element={
                  <CommunityPage
                    currentUser={currentUser}
                    showAlert={showAlert}
                    handleSubmitReport={
                      handleSubmitReport
                    }
                  />
                }
              />

              <Route
                path="/community/write"
                element={<PostWritePage />}
              />

              <Route
                path="/community/:postId"
                element={<PostDetailPage />}
              />

              <Route
                path="/community/:postId/edit"
                element={<PostEditPage />}
              />

              {/* 댓글 게시판 */}
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
                path="/comment/write"
                element={<PostWritePage />}
              />

              <Route
                path="/comment/:postId/edit"
                element={<PostEditPage />}
              />

              {/* 관리자 */}
              <Route
                path="/admin"
                element={<AdminPage />}
              />

              {/* 고객지원 */}
              <Route
                path="/support"
                element={<SupportPage />}
              />

              {/* 로그인 사용자의 잘못된 주소 */}
              <Route
                path="*"
                element={
                  <Navigate to="/dashboard" replace />
                }
              />
            </>
          ) : (
            <>
              {/* 비로그인 상태 접근 경로 */}
              <Route
                path="/"
                element={<LandingPage />}
              />

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

              <Route
                path="/auth/callback"
                element={<AuthCallback />}
              />

              {/* 비로그인 사용자의 잘못된 주소 */}
              <Route
                path="*"
                element={<Navigate to="/" replace />}
              />
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