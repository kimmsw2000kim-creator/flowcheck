import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, AlertCircle, RefreshCw, Globe, Monitor, Terminal, FileText } from 'lucide-react';
import { startUiTest, getUiTestStatus, UiTestStepData } from '../api/uiTestApi';

interface Domain {
  id: number;
  domainUrl: string;
  verified: boolean;
}

interface QaPageProps {
  domains: Domain[];
  selectedQaDomain: number;
  setSelectedQaDomain: (id: number) => void;
  currentUser: {
    id: string;
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
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [qaStatus, setQaStatus] = useState<string>('idle'); // idle, running, success, error
  const [qaSteps, setQaSteps] = useState<UiTestStepData[]>([]);
  const [qaReportMarkdown, setQaReportMarkdown] = useState<string>('');
  const [pollingId, setPollingId] = useState<NodeJS.Timeout | null>(null);

  // 도메인 선택 변경 시 URL 입력창 자동 반영
  useEffect(() => {
    const selected = domains.find(d => d.id === selectedQaDomain);
    if (selected) {
      setTargetUrl(selected.domainUrl);
    }
  }, [selectedQaDomain, domains]);

  // 언마운트 시 폴링 리소스 정리
  useEffect(() => {
    return () => {
      if (pollingId) {
        clearInterval(pollingId);
      }
    };
  }, [pollingId]);

  const handleRunQa = async () => {
    if (!targetUrl.trim()) {
      showAlert('테스트할 웹사이트 URL을 입력해 주세요.', 'error');
      return;
    }

    // 간단한 URL 형식 검증
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      showAlert('올바른 URL 형식(http:// 또는 https://)으로 입력해 주세요.', 'error');
      return;
    }

    if (currentUser.coupons <= 0 && currentUser.balance < 10000) {
      showAlert('쿠폰 또는 크레딧 잔액이 부족합니다.', 'error');
      return;
    }

    // 1. 프론트엔드 크레딧/쿠폰 로컬 차감 시뮬레이션 (상단 바 즉각 반응)
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
        description: 'AI QA 테스트 수행 (자율형 탐색)',
        createdAt: new Date().toISOString().substring(0, 16)
      });
    }

    setQaStatus('running');
    setQaSteps([]);
    setQaReportMarkdown('');

    try {
      // 2. 백엔드 호출
      const startRes = await startUiTest(targetUrl, currentUser.id);
      const requestId = startRes.requestId;
      
      showAlert('자율형 AI QA 탐색 에이전트가 가동되었습니다!', 'success');

      // 3. 폴링 시작 (1.5초 주기)
      const interval = setInterval(async () => {
        try {
          const statusRes = await getUiTestStatus(requestId);
          setQaSteps(statusRes.steps);

          if (statusRes.status === 'COMPLETED') {
            setQaStatus('success');
            setQaReportMarkdown(statusRes.report || '');
            clearInterval(interval);
            setPollingId(null);
            showAlert('자율형 AI QA 탐색이 완료되었습니다!', 'success');
          } else if (statusRes.status === 'FAILED') {
            setQaStatus('error');
            setQaReportMarkdown(statusRes.report || '# 테스트 실패\n\nAI 에이전트 탐색 중 비정상 종료되거나 에러가 발생했습니다.');
            clearInterval(interval);
            setPollingId(null);
            showAlert('AI QA 탐색 도중 에러가 발생하였습니다.', 'error');
          }
        } catch (pollErr) {
          console.error('Status polling error:', pollErr);
        }
      }, 1500);

      setPollingId(interval);

    } catch (err: any) {
      console.error('Failed to start UI Test:', err);
      setQaStatus('error');
      showAlert(err.message || 'AI 서버를 호출하지 못했습니다.', 'error');
    }
  };

  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', margin: 0 }}>AI 자율형 QA 익스플로러 (Playwright + Gemini)</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem', backgroundColor: 'var(--bg-secondary)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
          <Monitor size={14} style={{ color: 'var(--accent-hover)' }} />
          <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>💻 로컬 브라우저 구동 모드 (headless=False)</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        <div>
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem' }}>AI QA 탐색 시작</h3>
            
            <div className="form-group">
              <label className="form-label">인증 도메인 불러오기</label>
              <select 
                className="form-input" 
                value={selectedQaDomain} 
                onChange={(e) => setSelectedQaDomain(parseInt(e.target.value))}
                disabled={qaStatus === 'running'}
              >
                <option value="">-- 주소 선택하기 --</option>
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

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">테스트 대상 URL 주소</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
                <Globe size={18} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ paddingLeft: '2.25rem', width: '100%' }}
                  placeholder="https://example.com"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  disabled={qaStatus === 'running'}
                />
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              <p>⚡ <strong>소모 비용</strong>: 1회 테스트 쿠폰 또는 10,000 크레딧.</p>
              <p>🤖 Playwright 봇이 실제 브라우저를 열고 최대 10단계 동안 Gemini 2.5 Flash를 이용해 화면을 탐색합니다.</p>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              onClick={handleRunQa}
              disabled={qaStatus === 'running'}
            >
              {qaStatus === 'running' ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  <span>탐색 에이전트 구동 중...</span>
                </>
              ) : (
                <>
                  <Play size={16} fill="currentColor" />
                  <span>QA 테스트 시작</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div>
          <div className="card" style={{ minHeight: '450px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Terminal size={18} style={{ color: 'var(--text-secondary)' }} />
              <span>실시간 탐색 상황 (Telemetry)</span>
            </h3>
            
            {qaStatus === 'idle' && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 'auto' }}>
                <Play size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                <p>AI QA 분석을 시작하면 실시간 DOM 탐색 진행 상황이 표시됩니다.</p>
              </div>
            )}

            {qaStatus === 'running' && qaSteps.length === 0 && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 'auto' }}>
                <RefreshCw className="animate-spin" size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p>브라우저를 초기화하고 대상 주소로 이동하는 중입니다...</p>
              </div>
            )}

            {(qaStatus === 'running' || qaSteps.length > 0) && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {qaStatus === 'running' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-hover)', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                    <RefreshCw className="animate-spin" size={16} />
                    <span>Gemini AI와 Playwright가 화면 구조를 파악하고 이벤트를 유도하고 있습니다.</span>
                  </div>
                )}
                
                <div className="timeline" style={{ flex: 1, overflowY: 'auto', maxH: '400px' }}>
                  {qaSteps.map((step, idx) => (
                    <div className="timeline-step" key={idx} style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem', position: 'relative' }}>
                      <div className="timeline-dot" style={{
                        position: 'absolute',
                        left: 0,
                        top: '4px',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: step.error ? 'var(--error)' : 'var(--success)',
                        boxShadow: step.error ? '0 0 8px var(--error)' : '0 0 8px var(--success)'
                      }}></div>
                      <div className="timeline-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span className="timeline-action" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          단계 {step.step}: {step.action}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', wordBreak: 'break-all' }}>{step.url}</span>
                      </div>
                      <div className="timeline-desc" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        {step.error ? (
                          <div style={{ color: 'var(--error)', backgroundColor: 'var(--error-bg)', padding: '0.5rem 0.75rem', borderRadius: '0.25rem', marginTop: '0.25rem', border: '1px solid var(--error)' }}>
                            <strong>오류 발생:</strong> {step.error}
                          </div>
                        ) : (
                          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.5rem 0.75rem', borderRadius: '0.25rem', border: '1px solid var(--border)' }}>
                            {step.selector && (
                              <p style={{ margin: '0 0 0.25rem' }}>
                                <strong>선택자 (Selector):</strong> <code style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.3rem', borderRadius: '0.2rem' }}>{step.selector}</code> 
                                {step.text && <span> | <strong>입력 내용:</strong> "{step.text}"</span>}
                              </p>
                            )}
                            <p style={{ margin: 0 }}>
                              <strong>판단 근거 (Reasoning):</strong> {step.reason}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {qaStatus === 'success' && (
                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                    <div style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <CheckCircle size={18} />
                      <span>자율형 AI QA 탐색이 완료되었습니다! 아래 종합 리포트를 확인해 주세요.</span>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                        <FileText size={18} />
                        <h4 style={{ margin: 0 }}>Gemini UI/UX 종합 감사 보고서</h4>
                      </div>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        {qaReportMarkdown}
                      </pre>
                    </div>
                  </div>
                )}

                {qaStatus === 'error' && (
                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                    <div style={{ color: 'var(--error)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <AlertCircle size={18} />
                      <span>테스트 실행에 실패하였습니다.</span>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        {qaReportMarkdown}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
