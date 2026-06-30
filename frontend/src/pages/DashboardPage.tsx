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
        <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Welcome to FlowCheck Dashboard</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Monitor credits, run QA sweeps, and evaluate load tests.</p>
      </div>
      
      <div className="dashboard-grid">
        <div className="card">
          <div className="card-title"><CreditCard size={18} /> Credit Balance</div>
          <div className="card-value" style={{ color: 'var(--accent-hover)' }}>
            {currentUser.balance.toLocaleString()} <span style={{ fontSize: '1rem' }}>credits</span>
          </div>
        </div>
        <div className="card">
          <div className="card-title"><PlusCircle size={18} /> Prepaid Coupons</div>
          <div className="card-value">{currentUser.coupons} <span style={{ fontSize: '1rem' }}>runs left</span></div>
        </div>
        <div className="card">
          <div className="card-title"><Shield size={18} /> Registered Domains</div>
          <div className="card-value">
            {domains.length} <span style={{ fontSize: '1.2rem', color: 'var(--success)' }}>({domains.filter(d => d.verified).length} verified)</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem', textAlign: 'left' }}>
        <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Active Verified Target Websites</h3>
        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Domain Host URL</th>
                <th>Registered At</th>
                <th>Status</th>
                <th>QA Tests</th>
              </tr>
            </thead>
            <tbody>
              {domains.map(d => (
                <tr key={d.id}>
                  <td style={{ fontFamily: 'var(--mono)' }}>{d.domainUrl}</td>
                  <td>{d.createdAt}</td>
                  <td>
                    <span className={`badge ${d.verified ? 'badge-success' : 'badge-pending'}`}>
                      {d.verified ? 'Verified' : 'Pending'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                      onClick={() => { setActiveTab('qa'); setSelectedQaDomain(d.id); }}
                    >
                      Launch QA
                    </button>
                  </td>
                </tr>
              ))}
              {domains.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No registered domains found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
