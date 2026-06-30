import React from 'react';
import { Activity } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  setActivePost: (post: any) => void;
  currentUser: {
    email: string;
    role: string;
  };
  toggleRole: () => void;
}

export default function Header({ activeTab, setActiveTab, setActivePost, currentUser, toggleRole }: HeaderProps) {
  const handleNavClick = (tab: string) => {
    setActiveTab(tab);
    setActivePost(null);
  };

  return (
    <nav className="navbar">
      <div className="logo">
        <Activity size={24} />
        <span>FlowCheck</span>
      </div>
      <div className="nav-links">
        <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => handleNavClick('dashboard')}>Dashboard</button>
        <button className={`nav-item ${activeTab === 'domains' ? 'active' : ''}`} onClick={() => handleNavClick('domains')}>Domains</button>
        <button className={`nav-item ${activeTab === 'qa' ? 'active' : ''}`} onClick={() => handleNavClick('qa')}>AI QA</button>
        <button className={`nav-item ${activeTab === 'load' ? 'active' : ''}`} onClick={() => handleNavClick('load')}>Load Testing</button>
        <button className={`nav-item ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => handleNavClick('billing')}>Billing</button>
        <button className={`nav-item ${activeTab === 'community' ? 'active' : ''}`} onClick={() => setActiveTab('community')}>Community</button>
        <button className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => handleNavClick('admin')}>Admin & CS</button>
      </div>
      <div className="user-profile">
        <span style={{ color: 'var(--text-secondary)' }}>{currentUser.email}</span>
        <span className="role-badge">{currentUser.role}</span>
        <button onClick={toggleRole} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', borderRadius: '1rem' }}>
          Sim Role
        </button>
      </div>
    </nav>
  );
}
