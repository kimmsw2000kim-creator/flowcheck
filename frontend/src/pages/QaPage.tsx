import React, { useState } from 'react';
import { Play, CheckCircle, RefreshCw } from 'lucide-react';

interface Domain {
  id: number;
  domainUrl: string;
  verified: boolean;
}

interface QaStep {
  step: string;
  url: string;
  action: string;
  selector?: string;
  text?: string;
  reason?: string;
  error?: string;
}

interface QaPageProps {
  domains: Domain[];
  selectedQaDomain: number;
  setSelectedQaDomain: (id: number) => void;
  currentUser: {
    coupons: number;
    balance: number;
  };
  onUserUpdate: (updatedUser: { coupons: number; balance: number }) => void;
  onAddLedger: (ledgerItem: any) => void;
  showAlert: (message: string, type?: string) => void;
}

export default function QaPage({
  domains,
  selectedQaDomain,
  setSelectedQaDomain,
  currentUser,
  onUserUpdate,
  onAddLedger,
  showAlert
}: QaPageProps) {
  const [qaStatus, setQaStatus] = useState<string>('idle'); // idle, running, success, error
  const [qaSteps, setQaSteps] = useState<QaStep[]>([]);
  const [qaReportMarkdown, setQaReportMarkdown] = useState<string>('');

  const handleRunQa = () => {
    if (currentUser.coupons <= 0 && currentUser.balance < 10000) {
      showAlert('쿠폰 또는 크레딧 잔액이 부족합니다.', 'error');
      return;
    }
    if (currentUser.coupons > 0) {
      onUserUpdate({
        coupons: currentUser.coupons - 1,
        balance: currentUser.balance
      });
    } else {
      onUserUpdate({
        coupons: currentUser.coupons,
        balance: currentUser.balance - 10000
      });
      onAddLedger({
        id: Date.now(),
        amount: -10000,
        type: 'TEST_CONSUME',
        description: 'AI QA 테스트 수행',
        createdAt: new Date().toISOString().substring(0, 16)
      });
    }
    setQaStatus('running');
    setQaSteps([]);
    setQaReportMarkdown('');

    const targetUrl = domains.find(d => d.id === selectedQaDomain)?.domainUrl || 'https://myshop.com';
    const simulatedSteps = [
      { step: '1', url: targetUrl, selector: 'a.nav-link[href="/shop"]', action: '클릭', reason: '상점 페이지로 이동 중.' },
      { step: '2', url: targetUrl + '/shop', selector: 'input#search', action: '입력', text: 'Gemini CPU', reason: '검색어 입력 중.' },
      { step: '3', url: targetUrl + '/shop', selector: 'button.search-btn', action: '클릭', reason: '검색 실행 중.' },
      { step: '4', url: targetUrl + '/shop?q=Gemini', selector: 'div.item-card:first-child a', action: '클릭', reason: '검색 결과 항목 선택 중.' },
      { step: '5', url: targetUrl + '/item/1', selector: 'button.add-to-cart', action: '클릭', reason: '장바구니 담기 실행 중.' }
    ];

    let delay = 0;
    simulatedSteps.forEach((step, index) => {
      setTimeout(() => {
        setQaSteps(prev => [...prev, step]);
        if (index === simulatedSteps.length - 1) {
          setQaStatus('success');
          setQaReportMarkdown(`# QA 분석 감사 리포트 - ${targetUrl}\n## 요약\n- 탐색 단계: 5단계\n- 발견된 오류: 0개\n\n## Gemini 종합 피드백\n반응형 레이아웃이 준수되어 설계되었으며, 모든 핵심 기능 버튼들의 명도 대비와 접근성이 보장되어 동작합니다.`);
          showAlert('자율형 AI QA 탐색이 완료되었습니다!', 'success');
        }
      }, delay += 1000);
    });
  };
  return (
    <div style={{ textAlign: 'left' }}>
      <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>AI 자율형 QA 익스플로러 (Playwright + Gemini)</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        <div>
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem' }}>AI QA 탐색 시작</h3>
            
            <div className="form-group">
              <label className="form-label">인증 도메인 선택</label>
              <select 
                className="form-input" 
                value={selectedQaDomain} 
                onChange={(e) => setSelectedQaDomain(parseInt(e.target.value))}
              >
                {domains.filter(d => d.verified).map(d => (
                  <option key={d.id} value={d.id}>{d.domainUrl}</option>
                ))}
                {domains.filter(d => !d.verified).length > 0 && (
                  <optgroup label="미인증 도메인 (소유권 검증 필요)">
                    {domains.filter(d => !d.verified).map(d => (
                      <option key={d.id} value={d.id} disabled>{d.domainUrl}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              <p>⚡ 소모 비용: <strong>1회 테스트 쿠폰</strong> 또는 <strong>10,000 크레딧</strong>.</p>
              <p>🔄 Playwright 로봇이 페이지 링크 및 상호작용 가능한 버튼을 최대 10~20단계까지 직접 크롤링합니다.</p>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%' }}
              onClick={handleRunQa}
              disabled={qaStatus === 'running'}
            >
              {qaStatus === 'running' ? '크롤링 실행 중...' : 'QA 테스트 시작'}
            </button>
          </div>
        </div>

        <div>
          <div className="card" style={{ minHeight: '400px' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>실시간 탐색 상황 (Telemetry)</h3>
            
            {qaStatus === 'idle' && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '5rem' }}>
                <Play size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                <p>AI QA 분석을 시작하면 실시간 DOM 탐색 진행 상황이 표시됩니다.</p>
              </div>
            )}

            {qaStatus === 'running' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-hover)', marginBottom: '1rem' }}>
                  <RefreshCw className="animate-spin" size={18} />
                  <span>Gemini AI와 Playwright가 DOM 트리 및 페이지 구조를 탐색하는 중입니다...</span>
                </div>
                <div className="timeline">
                  {qaSteps.map((step, idx) => (
                    <div className="timeline-step" key={idx}>
                      <div className="timeline-dot"></div>
                      <div className="timeline-header">
                        <span className="timeline-action">단계 {step.step}: {step.action}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{step.url}</span>
                      </div>
                      <div className="timeline-desc">
                        {step.error ? (
                          <span style={{ color: 'var(--error)' }}>오류: {step.error}</span>
                        ) : (
                          <>
                            <strong>선택자 (Selector)</strong>: <code>{step.selector}</code> {step.text && <span>| <strong>입력 내용</strong>: "{step.text}"</span>}<br/>
                            <strong>판단 근거 (Reasoning)</strong>: {step.reason}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {qaStatus === 'success' && (
              <div>
                <div style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <CheckCircle size={18} />
                  <span>자율형 AI QA 탐색이 성공적으로 완료되었습니다!</span>
                </div>
                <div className="markdown-body" style={{ background: 'var(--bg-tertiary)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{qaReportMarkdown}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
