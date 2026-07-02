import React, { useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import Header from './components/Header';
import Footer from './components/Footer';

// Pages
import DashboardPage from './pages/DashboardPage';
import DomainsPage from './pages/DomainsPage';
import QaPage from './pages/QaPage';
import LoadPage from './pages/LoadPage';
import BillingPage from './pages/BillingPage';
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
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [currentUser, setCurrentUser] = useState({
    id: 'f87a32d1-921c-4b9b-90f3-cb2071850123',
    email: 'corp-user@flowcheck.com',
    role: 'USER', // USER or ADMIN
    balance: 75000,
    status: 'ACTIVE',
    coupons: 3
  });

  const [domains, setDomains] = useState<Domain[]>([
    { id: 1, domainUrl: 'https://myshop.com', verificationToken: 'overload-verify-da39a3ee5e6b4b0d3255bfef95601890afd80709', verified: true, createdAt: '2026-06-25' },
    { id: 2, domainUrl: 'https://testapp.io', verificationToken: 'overload-verify-7c5a0c3b9b8b7d6e5a4c3b2a1a', verified: false, createdAt: '2026-06-29' }
  ]);
  const [newDomainUrl, setNewDomainUrl] = useState<string>('');
  const [verificationLoading, setVerificationLoading] = useState<boolean>(false);
  const [selectedQaDomain, setSelectedQaDomain] = useState<number>(1);

  const [ledger, setLedger] = useState<LedgerItem[]>([
    { id: 1, amount: 50000, type: 'CHARGE', description: '토스페이먼츠 가상계좌 크레딧 충전', createdAt: '2026-06-29 14:20' },
    { id: 2, amount: -30000, type: 'COUPON_BUY', description: '선결제 테스트 쿠폰 구매: 3회권', createdAt: '2026-06-29 14:30' },
    { id: 3, amount: 20000, type: 'PROMOTION', description: 'WELCOME2026', createdAt: '2026-06-30 09:00' }
  ]);

  const [reports, setReports] = useState<Report[]>([
    { id: 1, reporterId: 'd290f1e2-b8b8-4d56-bc9b-3e5f6e872111', targetType: 'POST', targetId: 1, reason: '스팸성 홍보글', status: 'PENDING', createdAt: '2026-06-30' }
  ]);

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
        {activeTab === 'dashboard' && (
          <DashboardPage
            currentUser={currentUser}
            domains={domains}
            setActiveTab={setActiveTab}
            setSelectedQaDomain={setSelectedQaDomain}
          />
        )}

        {activeTab === 'domains' && (
          <DomainsPage
            domains={domains}
            newDomainUrl={newDomainUrl}
            setNewDomainUrl={setNewDomainUrl}
            handleAddDomain={handleAddDomain}
            handleVerifyDomain={handleVerifyDomain}
            verificationLoading={verificationLoading}
          />
        )}

        {activeTab === 'qa' && (
          <QaPage
            domains={domains}
            selectedQaDomain={selectedQaDomain}
            setSelectedQaDomain={setSelectedQaDomain}
            currentUser={currentUser}
            onUserUpdate={handleUserUpdate}
            onAddLedger={handleAddLedger}
            showAlert={showAlert}
          />
        )}

        {activeTab === 'load' && (
          <LoadPage
            domains={domains}
            currentUser={currentUser}
            onUserUpdate={handleUserUpdate}
            onAddLedger={handleAddLedger}
            showAlert={showAlert}
          />
        )}

        {activeTab === 'billing' && (
          <BillingPage
            currentUser={currentUser}
            onUserUpdate={handleUserUpdate}
            ledger={ledger}
            onAddLedger={handleAddLedger}
            showAlert={showAlert}
          />
        )}

        {activeTab === 'community' && (
          <CommunityPage
            currentUser={currentUser}
            onUserUpdate={handleUserUpdate}
            ledger={ledger}
            onAddLedger={handleAddLedger}
            showAlert={showAlert}
            handleSubmitReport={handleSubmitReport}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPage
            currentUser={currentUser}
            reports={reports}
            setReports={setReports}
            handleSuspendUser={handleSuspendUser}
            showAlert={showAlert}
          />
        )}

        {activeTab === 'mypage' && (
          <Mypage />
        )}

        {(activeTab === 'login' || activeTab === 'signup') && (
          <AuthPage 
            setActiveTab={setActiveTab} 
            onLoginSuccess={(email) => setCurrentUser(prev => ({ ...prev, email }))}
            showAlert={showAlert}
            initialMode={activeTab === 'signup' ? 'signup' : 'login'}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}

export default App;
