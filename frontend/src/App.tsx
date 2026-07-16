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
import './styles/CommunityPages.css';
import './styles/AppShell.css';
import './styles/UtilityPages.css';

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

interface LedgerItem {
  id: number;
  amount: number;
  type: string;
  description: string;
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

  const currentUser = useUserStore(
    (state) => state.currentUser,
  );

  const authStatus = useUserStore(
    (state) => state.authStatus,
  );

  const alertMsg = useAlertStore(
    (state) => state.alertMsg,
  );

  const showAlert = useAlertStore(
    (state) => state.showAlert,
  );

  const [, setReports] = useState<Report[]>([]);
  const [, setLedger] = useState<LedgerItem[]>([]);

  const [selectedUIUXTestDomain, setSelectedUIUXTestDomain] =
    useState<number>(1);

  const handleAddLedger = (ledgerItem: LedgerItem) => {
    setLedger((previousLedger) => [
      ledgerItem,
      ...previousLedger,
    ]);
  };

  /*
   * authStatus가 authenticated이고 currentUser가 있을 때만
   * null이 아닌 사용자 객체로 취급합니다.
   */
  const authenticatedUser =
    authStatus === 'authenticated' && currentUser
      ? currentUser
      : null;

  const isLoggedIn = authenticatedUser !== null;

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

  const handleSubmitReport = (
    type: string,
    id: number,
  ) => {
    if (!authenticatedUser) {
      showAlert('로그인이 필요합니다.', 'warning');
      return;
    }

    const report: Report = {
      id: Date.now(),
      reporterId: authenticatedUser.id,
      targetType: type,
      targetId: id,
      reason: '부적절한 내용',
      status: 'PENDING',
      createdAt: new Date()
        .toISOString()
        .split('T')[0],
    };

    setReports((previousReports) => [
      ...previousReports,
      report,
    ]);

    showAlert('신고가 접수되었습니다.', 'success');
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
            className="app-loading-state"
            role="status"
            aria-live="polite"
          >
            앱을 불러오는 중입니다.
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

      <a
        className="skip-link"
        href="#main-content"
      >
        본문으로 건너뛰기
      </a>

      <Header activeTab={activeTab} />

      <main
        id="main-content"
        className={
          isLandingPage
            ? 'landing-main'
            : 'main-content'
        }
      >
        <Routes>
          {authenticatedUser ? (
            <>
              {/* 로그인 상태 접근 경로 */}
              <Route
                path="/"
                element={
                  <Navigate
                    to="/dashboard"
                    replace
                  />
                }
              />

              <Route
                path="/login"
                element={
                  <Navigate
                    to="/dashboard"
                    replace
                  />
                }
              />

              <Route
                path="/signup"
                element={
                  <Navigate
                    to="/dashboard"
                    replace
                  />
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
                    onAddLedger={handleAddLedger}
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
                    currentUser={
                      authenticatedUser
                    }
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
                  <Navigate
                    to="/dashboard"
                    replace
                  />
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
                element={
                  <Navigate
                    to="/"
                    replace
                  />
                }
              />
            </>
          )}
        </Routes>
      </main>

      {isLandingPage && (
        <Footer variant="full" />
      )}

      {isLoggedIn && (
        <Footer variant="compact" />
      )}

      <Chatbot />
    </div>
  );
}

export default App;
