import React from 'react';
import { Activity } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: {
    email: string;
    role: string;
  };
  toggleRole: () => void;

  isLoggedIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
}


export default function Header({ activeTab, setActiveTab, currentUser, toggleRole }: HeaderProps) {
  const handleNavClick = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <nav className="navbar">
      <div className="logo" style={{ cursor: 'pointer' }} onClick={() => handleNavClick('dashboard')}>
        <Activity size={24} />
        <span>FlowCheck</span>
      </div>
      <div className="nav-links">
        <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => handleNavClick('dashboard')}>대시보드</button>
        <button className={`nav-item ${activeTab === 'domains' ? 'active' : ''}`} onClick={() => handleNavClick('domains')}>도메인 관리</button>
        <button className={`nav-item ${activeTab === 'qa' ? 'active' : ''}`} onClick={() => handleNavClick('qa')}>AI QA 분석</button>
        <button className={`nav-item ${activeTab === 'load' ? 'active' : ''}`} onClick={() => handleNavClick('load')}>부하 테스트</button>
        <button className={`nav-item ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => handleNavClick('billing')}>요금 및 충전</button>
        <button className={`nav-item ${activeTab === 'community' ? 'active' : ''}`} onClick={() => setActiveTab('community')}>커뮤니티</button>
        <button className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => handleNavClick('admin')}>관리자 및 고객지원</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div className="user-profile">
          <span style={{ color: 'var(--text-secondary)' }}>{currentUser.email}</span>
          <span className="role-badge">{currentUser.role === 'ADMIN' ? '관리자' : '일반 사용자'}</span>
          <button onClick={toggleRole} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', borderRadius: '1rem' }}>
            역할 전환
          </button>
        </div>
        <button 
          onClick={() => handleNavClick('login')} 
          className={`nav-item ${activeTab === 'login' || activeTab === 'signup' ? 'active' : ''}`}
        >
          로그인/회원가입
        </button>
        <button 
          onClick={() => handleNavClick('mypage')} 
          className={`nav-item ${activeTab === 'mypage' ? 'active' : ''}`}
        >
          마이페이지
        </button>
      </div>
    </nav>
  );
}