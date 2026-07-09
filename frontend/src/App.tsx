import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import Header from './components/Header';
import Footer from './components/Footer';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

// Pages
import DashboardPage from './pages/DashboardPage';
import DomainsPage from './pages/DomainsPage';
import UiTestPage from './pages/UitestPage';
import LoadPage from './pages/LoadPage';
import PaymentPage from './pages/PaymentPage';
import CommunityPage from './pages/CommunityPage';
import PostWritePage from "./pages/PostWritePage";
import PostDetailPage from "./pages/PostDetailPage";
import PostEditPage from "./pages/PostEditPage";
import AdminPage from './pages/AdminPage';
import Mypage from './pages/Mypage';
import AuthPage from './pages/AuthPage';
import AuthCallback from './pages/AuthCallback';
import LandingPage from './pages/LandingPage';
import CommentPage from "./pages/CommentPage";

// Types & Utils
import axios from 'axios';
import ApiURL from './api/ApiURL';
import type { Domain } from './types/domain';
import { fetchDomains, registerDomain, verifyDomain, deleteDomain } from './api/domainApi';

axios.defaults.baseURL = ApiURL;

// Axios Request Interceptor: Automatically attach Authorization header
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Axios Response Interceptor: Global 401 Unauthorized Handler
axios.interceptors.response.use((response) => response, (error) => {
  if (error.response && error.response.status === 401) {
    localStorage.clear();
    window.location.href = '/login';
  }
  return Promise.reject(error);
});

interface LedgerItem {
  id: number;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

interface Report {
  id: number;
  reporterId: string;
  targetType: string;
  targetId: number;
  reason: string;
  status: string;
  createdAt: string;
}

interface AlertMsg {
  message: string;
  type: string;
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabRoutes: Record<string, string> = {
    dashboard: '/dashboard',
    mypage: '/mypage',
    domains: '/domains',
    uitest: '/uitest',
    load: '/load',
    billing: '/billing',
    community: '/community',
    admin: '/admin',
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

  const [currentUser, setCurrentUser] = useState({
    id: localStorage.getItem("userId") ?? '',
    email: localStorage.getItem("email") ?? '',
    role: 'USER', // USER or ADMIN
    balance: 0,
    status: 'ACTIVE',
    coupons: 0,
    loadTestCoupons: 0,
    uiUxTestCoupons: 0
  });

  const isLoggedIn = !!currentUser.email;
  const isLandingPage = !isLoggedIn && location.pathname === '/';

  // Fetch User Profile and Billing Ledger
  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      axios.get('/api/mypage')
        .then((res) => {
          const data = res.data;
          setCurrentUser(prev => ({
            ...prev,
            email: data.email,
            balance: data.balance,
            coupons: data.couponCount,
            loadTestCoupons: data.loadTestCouponCount,
            uiUxTestCoupons: data.uiUxTestCouponCount
          }));
        })
        .catch((err) => {
          console.error("Failed to load user profile session:", err);
        });

      axios.get('/api/payment/ledger')
        .then((res) => {
          setLedger(res.data);
        })
        .catch((err) => {
          console.error("Failed to load ledger history:", err);
        });
    }
  }, [currentUser.email]);

  // Fetch Verified Domain List
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomainUrl, setNewDomainUrl] = useState<string>('');
  const [verificationLoading, setVerificationLoading] = useState<boolean>(false);

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      fetchDomains()
        .then((data) => {
          setDomains(data);
        })
        .catch((err) => {
          console.error("Failed to load domains:", err.message);
        });
    }
  }, [currentUser.email]);

  const [selectedUiTestDomain, setSelectedUiTestDomain] = useState<number>(1);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [alertMsg, setAlertMsg] = useState<AlertMsg | null>(null);

  const showAlert = (message: string, type: string = 'success') => {
    setAlertMsg({ message, type });
    setTimeout(() => setAlertMsg(null), 5000);
  };

  const toggleRole = () => {
    const nextRole = currentUser.role === 'USER' ? 'ADMIN' : 'USER';
    setCurrentUser(prev => ({ ...prev, role: nextRole }));
    showAlert(`시뮬레이션 역할을 ${nextRole === 'ADMIN' ? '관리자' : '일반 사용자'}(으)로 전환했습니다.`, 'info');
  };

  const handleLogout = () => {
    localStorage.clear();
    setCurrentUser({
      id: '',
      email: '',
      role: 'USER',
      balance: 0,
      status: 'ACTIVE',
      coupons: 0,
      loadTestCoupons: 0,
      uiUxTestCoupons: 0
    });
    navigate('/login');
  };

  const handleLoginSuccess = (email: string, _token?: string, userId?: string) => {
    if (email) localStorage.setItem("email", email);
    if (userId) localStorage.setItem("userId", userId);

    setCurrentUser(prev => ({
      ...prev,
      id: userId ?? prev.id,
      email
    }));
    navigate("/dashboard");
  };

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainUrl) return;
    if (!currentUser.email) {
      showAlert('로그인이 필요합니다.', 'error');
      return;
    }
    registerDomain(newDomainUrl)
      .then((data) => {
        setDomains(prev => [data, ...prev]);
        setNewDomainUrl('');
        showAlert('도메인이 등록되었습니다. 소유권 검증 토큰을 적용한 후 지금 검증하기를 클릭하세요.');
      })
      .catch((err) => {
        showAlert(err.message, 'error');
      });
  };

  const handleVerifyDomain = (id: number) => {
    setVerificationLoading(true);
    if (!currentUser.email) {
      showAlert('로그인이 필요합니다.', 'error');
      setVerificationLoading(false);
      return;
    }
    verifyDomain(id)
      .then(() => {
        setDomains(prev => prev.map(d => d.id === id ? { ...d, verified: true } : d));
        setVerificationLoading(false);
        showAlert('도메인 소유권 검증이 완료되었습니다!');
      })
      .catch((err) => {
        setVerificationLoading(false);
        showAlert(err.message, 'error');
      });
  };

  const handleDeleteDomain = (id: number) => {
    if (!window.confirm("정말로 이 도메인을 삭제하시겠습니까?")) return;
    if (!currentUser.email) {
      showAlert('로그인이 필요합니다.', 'error');
      return;
    }
    deleteDomain(id)
      .then(() => {
        setDomains(prev => prev.filter(d => d.id !== id));
        showAlert('도메인이 정상적으로 삭제되었습니다.');
      })
      .catch((err) => {
        showAlert(err.message, 'error');
      });
  };

  const handleUserUpdate = (updatedUser: { balance: number; coupons: number; loadTestCoupons?: number; uiUxTestCoupons?: number }) => {
    setCurrentUser(prev => ({
      ...prev,
      balance: updatedUser.balance,
      coupons: updatedUser.coupons,
      loadTestCoupons: updatedUser.loadTestCoupons !== undefined ? updatedUser.loadTestCoupons : prev.loadTestCoupons,
      uiUxTestCoupons: updatedUser.uiUxTestCoupons !== undefined ? updatedUser.uiUxTestCoupons : prev.uiUxTestCoupons
    }));
  };

  const handleAddLedger = (ledgerItem: LedgerItem) => {
    setLedger(prev => [ledgerItem, ...prev]);
  };

  const handleSubmitReport = (type: string, id: number) => {
    const report: Report = {
      id: reports.length + 1,
      reporterId: currentUser.id,
      targetType: type,
      targetId: id,
      reason: '부적절한 내용물',
      status: 'PENDING',
      createdAt: new Date().toISOString().split('T')[0]
    };
    setReports([...reports, report]);
    showAlert('신고가 접수되었습니다.');
  };

  const handleSuspendUser = (targetUserId: string) => {
    showAlert(`해당 유저(${targetUserId})가 7일간 서비스 정지 처리되었습니다.`, 'success');
  };

  return (
    <div className="app-container">
      {alertMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: alertMsg.type === 'error' ? 'var(--error-bg)' :
            alertMsg.type === 'warning' ? 'var(--warning-bg)' : 'var(--bg-secondary)',
          color: alertMsg.type === 'error' ? 'var(--error)' :
            alertMsg.type === 'warning' ? 'var(--warning)' : 'var(--success)',
          padding: '1rem 1.5rem',
          borderRadius: '0.5rem',
          border: `1px solid ${alertMsg.type === 'error' ? 'var(--error)' : 'var(--success)'}`,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          boxShadow: 'var(--card-shadow)',
          backdropFilter: 'blur(8px)'
        }}>
          {alertMsg.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          <span>{alertMsg.message}</span>
        </div>
      )}

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        toggleRole={toggleRole}
      />

      <main className={isLandingPage ? "landing-main" : "main-content"}>
        <Routes>
          {isLoggedIn ? (
            <>
              {/* Authenticated Routes */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<Navigate to="/dashboard" replace />} />
              <Route path="/signup" element={<Navigate to="/dashboard" replace />} />

              <Route
                path="/dashboard"
                element={
                  <DashboardPage
                    currentUser={currentUser}
                    domains={domains}
                    setActiveTab={setActiveTab}
                    setSelectedUiTestDomain={setSelectedUiTestDomain}
                  />
                }
              />

              <Route path="/mypage/*" element={<Mypage />} />

              <Route
                path="/domains"
                element={
                  <DomainsPage
                    domains={domains}
                    newDomainUrl={newDomainUrl}
                    setNewDomainUrl={setNewDomainUrl}
                    handleAddDomain={handleAddDomain}
                    handleVerifyDomain={handleVerifyDomain}
                    handleDeleteDomain={handleDeleteDomain}
                    verificationLoading={verificationLoading}
                  />
                }
              />

              <Route
                path="/uitest"
                element={
                  <UiTestPage
                    domains={domains}
                    selectedUiTestDomain={selectedUiTestDomain}
                    setSelectedUiTestDomain={setSelectedUiTestDomain}
                    currentUser={currentUser}
                    onUserUpdate={handleUserUpdate}
                    onAddLedger={handleAddLedger}
                    showAlert={showAlert}
                  />
                }
              />

              <Route
                path="/load"
                element={
                  <LoadPage
                    domains={domains}
                    currentUser={currentUser}
                    onUserUpdate={handleUserUpdate}
                    onAddLedger={handleAddLedger}
                    showAlert={showAlert}
                  />
                }
              />

              <Route
                path="/billing"
                element={
                  <PaymentPage
                    currentUser={currentUser}
                    onUserUpdate={handleUserUpdate}
                    ledger={ledger}
                    onAddLedger={handleAddLedger}
                    showAlert={showAlert}
                  />
                }
              />

              {/* Community Tab Sub-routing System */}
              <Route
                path="/community"
                element={
                  <CommunityPage
                    currentUser={currentUser}
                    onUserUpdate={handleUserUpdate}
                    ledger={ledger}
                    onAddLedger={handleAddLedger}
                    showAlert={showAlert}
                    handleSubmitReport={handleSubmitReport}
                  />
                }
              />
              <Route path="/community/write" element={<PostWritePage />} />
              <Route path="/community/:postId" element={<PostDetailPage />} />
              <Route path="/community/:postId/edit" element={<PostEditPage />} />

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
                  <AdminPage
                    currentUser={currentUser}
                    reports={reports}
                    setReports={setReports}
                    handleSuspendUser={handleSuspendUser}
                    showAlert={showAlert}
                  />
                }
              />

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
                    onLoginSuccess={handleLoginSuccess}
                    showAlert={showAlert}
                    initialMode="login"
                  />
                }
              />
              <Route
                path="/signup"
                element={
                  <AuthPage
                    setActiveTab={setActiveTab}
                    onLoginSuccess={handleLoginSuccess}
                    showAlert={showAlert}
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