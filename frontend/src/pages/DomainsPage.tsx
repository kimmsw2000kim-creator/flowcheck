import React from 'react';
import { CheckCircle, RefreshCw } from 'lucide-react';

interface Domain {
  id: number;
  domainUrl: string;
  verificationToken: string;
  verified: boolean;
  createdAt: string;
}

interface DomainsPageProps {
  domains: Domain[];
  newDomainUrl: string;
  setNewDomainUrl: (url: string) => void;
  handleAddDomain: (e: React.FormEvent) => void;
  handleVerifyDomain: (id: number) => void;
  verificationLoading: boolean;
}

export default function DomainsPage({
  domains,
  newDomainUrl,
  setNewDomainUrl,
  handleAddDomain,
  handleVerifyDomain,
  verificationLoading
}: DomainsPageProps) {
  return (
    <div style={{ textAlign: 'left' }}>
      <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Domain Ownership Verification</h2>
      
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Register New Site</h3>
        <form onSubmit={handleAddDomain} style={{ display: 'flex', gap: '1rem' }}>
          <input 
            type="url" 
            className="form-input" 
            placeholder="https://mybusiness.com" 
            value={newDomainUrl} 
            onChange={(e) => setNewDomainUrl(e.target.value)} 
            required 
          />
          <button type="submit" className="btn btn-primary">Add Domain</button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Ownership Verification List</h3>
        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Host URL</th>
                <th>Verification Meta Tag / Text File Content</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {domains.map(d => (
                <tr key={d.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{d.domainUrl}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Registered: {d.createdAt}</div>
                  </td>
                  <td>
                    {d.verified ? (
                      <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CheckCircle size={16} /> Verification Active
                      </span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ fontSize: '0.85rem' }}>
                          Add to website head:<br/>
                          <code style={{ fontSize: '0.8rem' }}>&lt;meta name="overload-verification" content="{d.verificationToken}"&gt;</code>
                        </div>
                        <div style={{ fontSize: '0.85rem' }}>
                          Or host txt file at:<br/>
                          <code style={{ fontSize: '0.8rem' }}>{d.domainUrl}/.well-known/overload-verification.txt</code> contains <code>{d.verificationToken}</code>
                        </div>
                      </div>
                    )}
                  </td>
                  <td>
                    {d.verified ? (
                      <span className="badge badge-success">Verified</span>
                    ) : (
                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                        onClick={() => handleVerifyDomain(d.id)}
                        disabled={verificationLoading}
                      >
                        {verificationLoading ? <RefreshCw className="animate-spin" size={16} /> : 'Verify Now'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {domains.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No domains registered yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
