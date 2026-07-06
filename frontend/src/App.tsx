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
import AdminPage from './pages/AdminPage';
import Mypage from './pages/Mypage';
import AuthPage from './pages/AuthPage';

// Utils
import axios from 'axios';
import ApiURL from './api/ApiURL';

axios.defaults.baseURL = ApiURL;

interface Domain {
  id: number;
  domainUrl: string;
  verificationToken: string;
  verified: boolean;
  createdAt: string;
}

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
  };

  const activeTab =
    Object.entries(tabRoutes).find(([, path]) => path === location.pathname)?.[0] ?? 'dashboard';

  const setActiveTab = (tab: string) => {
    navigate(tabRoutes[tab] ?? '/dashboard');
  };
  const [currentUser, setCurrentUser] = useState({
    id: '',
    email: localStorage.getItem("email") ?? '',
    role: 'USER', // USER or ADMIN
    balance: 0,
    status: 'ACTIVE',
    coupons: 0
  });

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      axios.get('/api/mypage', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then((res) => {
        const data = res.data;
        setCurrentUser(prev => ({
          ...prev,
          email: data.email,
          balance: data.balance,
          coupons: data.couponCount
        }));
      })
      .catch((err) => {
        console.error("Failed to load user profile session:", err);
      });
    }
  }, [currentUser.email]);

  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomainUrl, setNewDomainUrl] = useState<string>('');
  const [verificationLoading, setVerificationLoading] = useState<boolean>(false);
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

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainUrl) return;
    const newDom: Domain = {
      id: domains.length + 1,
      domainUrl: newDomainUrl,
      verificationToken: 'overload-verify-' + Math.random().toString(36).substring(2),
      verified: false,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setDomains([...domains, newDom]);
    setNewDomainUrl('');
    showAlert('도메인이 임시 등록되었습니다. 소유권 검증 토큰 태그를 적용해 주세요.');
  };

  const handleVerifyDomain = (id: number) => {
    setVerificationLoading(true);
    setTimeout(() => {
      setDomains(domains.map(d => d.id === id ? { ...d, verified: true } : d));
      setVerificationLoading(false);
      showAlert('도메인 소유권 검증이 완료되었습니다!');
    }, 1500);
  };

  const handleUserUpdate = (updatedUser: { balance: number; coupons: number }) => {
    setCurrentUser(prev => ({
      ...prev,
      balance: updatedUser.balance,
      coupons: updatedUser.coupons
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

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
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

          <Route
            path="/login"
            element={
              <AuthPage 
                setActiveTab={setActiveTab} 
                onLoginSuccess={(email) => setCurrentUser(prev => ({ ...prev, email }))}
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
                onLoginSuccess={(email) => setCurrentUser(prev => ({ ...prev, email }))}
                showAlert={showAlert}
                initialMode="signup"
              />
            }
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

export default App;
