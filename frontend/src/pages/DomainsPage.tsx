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
      <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>도메인 소유권 검증 및 관리</h2>
      
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>새로운 사이트 등록</h3>
        <form onSubmit={handleAddDomain} style={{ display: 'flex', gap: '1rem' }}>
          <input 
            type="url" 
            className="form-input" 
            placeholder="https://mybusiness.com" 
            value={newDomainUrl} 
            onChange={(e) => setNewDomainUrl(e.target.value)} 
            required 
          />
          <button type="submit" className="btn btn-primary">도메인 추가</button>
        </form>
      </div>
 
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>소유권 검증 및 연동 목록</h3>
        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>호스트 URL</th>
                <th>검증용 메타 태그 / 텍스트 파일 내용</th>
                <th>검증 상태 및 실행</th>
              </tr>
            </thead>
            <tbody>
              {domains.map(d => (
                <tr key={d.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{d.domainUrl}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>등록일: {d.createdAt}</div>
                  </td>
                  <td>
                    {d.verified ? (
                      <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CheckCircle size={16} /> 검증 완료 및 연동 활성화
                      </span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ fontSize: '0.85rem' }}>
                          웹사이트 &lt;head&gt; 영역에 아래 메타 태그 추가:<br/>
                          <code style={{ fontSize: '0.8rem' }}>&lt;meta name="overload-verification" content="{d.verificationToken}"&gt;</code>
                        </div>
                        <div style={{ fontSize: '0.85rem' }}>
                          또는 아래 경로에 텍스트 파일 업로드:<br/>
                          <code style={{ fontSize: '0.8rem' }}>{d.domainUrl}/.well-known/overload-verification.txt</code> 파일 내용: <code>{d.verificationToken}</code>
                        </div>
                      </div>
                    )}
                  </td>
                  <td>
                    {d.verified ? (
                      <span className="badge badge-success">인증 완료</span>
                    ) : (
                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                        onClick={() => handleVerifyDomain(d.id)}
                        disabled={verificationLoading}
                      >
                        {verificationLoading ? <RefreshCw className="animate-spin" size={16} /> : '지금 검증하기'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {domains.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>아직 등록된 도메인이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
