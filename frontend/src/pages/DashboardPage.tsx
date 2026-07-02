import React from 'react';
import { CreditCard, PlusCircle, Shield } from 'lucide-react';

interface Domain {
  id: number;
  domainUrl: string;
  verified: boolean;
  createdAt: string;
}

interface DashboardPageProps {
  currentUser: {
    balance: number;
    coupons: number;
  };
  domains: Domain[];
  setActiveTab: (tab: string) => void;
  setSelectedQaDomain: (id: number) => void;
}

export default function DashboardPage({ currentUser, domains, setActiveTab, setSelectedQaDomain }: DashboardPageProps) {
  return (
    <div>
      <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>FlowCheck 대시보드</h2>
        <p style={{ color: 'var(--text-secondary)' }}>크레딧 모니터링, AI QA 수행, 그리고 부하 테스트 평가를 한눈에 관리하세요.</p>
      </div>
      
      <div className="dashboard-grid">
        <div className="card">
          <div className="card-title"><CreditCard size={18} /> 보유 크레딧 잔액</div>
          <div className="card-value" style={{ color: 'var(--accent-hover)' }}>
            {currentUser.balance.toLocaleString()} <span style={{ fontSize: '1rem' }}>크레딧</span>
          </div>
        </div>
        <div className="card">
          <div className="card-title"><PlusCircle size={18} /> 선결제 테스트 쿠폰</div>
          <div className="card-value">{currentUser.coupons} <span style={{ fontSize: '1rem' }}>회 남음</span></div>
        </div>
        <div className="card">
          <div className="card-title"><Shield size={18} /> 등록된 대상 도메인</div>
          <div className="card-value">
            {domains.length} <span style={{ fontSize: '1.2rem', color: 'var(--success)' }}>({domains.filter(d => d.verified).length}개 인증됨)</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem', textAlign: 'left' }}>
        <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>인증 완료된 활성 대상 웹사이트</h3>
        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>도메인 호스트 URL</th>
                <th>등록일</th>
                <th>상태</th>
                <th>QA 테스트</th>
              </tr>
            </thead>
            <tbody>
              {domains.map(d => (
                <tr key={d.id}>
                  <td style={{ fontFamily: 'var(--mono)' }}>{d.domainUrl}</td>
                  <td>{d.createdAt}</td>
                  <td>
                    <span className={`badge ${d.verified ? 'badge-success' : 'badge-pending'}`}>
                      {d.verified ? '인증됨' : '대기 중'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                      onClick={() => { setActiveTab('qa'); setSelectedQaDomain(d.id); }}
                    >
                      QA 분석 실행
                    </button>
                  </td>
                </tr>
              ))}
              {domains.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>등록된 도메인이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
