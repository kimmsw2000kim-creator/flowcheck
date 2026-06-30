import React from 'react';
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
  qaStatus: string;
  qaSteps: QaStep[];
  qaReportMarkdown: string;
  handleRunQa: () => void;
}

export default function QaPage({
  domains,
  selectedQaDomain,
  setSelectedQaDomain,
  qaStatus,
  qaSteps,
  qaReportMarkdown,
  handleRunQa
}: QaPageProps) {
  return (
    <div style={{ textAlign: 'left' }}>
      <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>AI Autonomous QA Explorer (Playwright + Gemini)</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        <div>
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem' }}>Trigger AI QA Crawl</h3>
            
            <div className="form-group">
              <label className="form-label">Select Verified Domain</label>
              <select 
                className="form-input" 
                value={selectedQaDomain} 
                onChange={(e) => setSelectedQaDomain(parseInt(e.target.value))}
              >
                {domains.filter(d => d.verified).map(d => (
                  <option key={d.id} value={d.id}>{d.domainUrl}</option>
                ))}
                {domains.filter(d => !d.verified).length > 0 && (
                  <optgroup label="Unverified (Requires verification)">
                    {domains.filter(d => !d.verified).map(d => (
                      <option key={d.id} value={d.id} disabled>{d.domainUrl}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              <p>⚡ Costs: <strong>1 prepaid coupon</strong> or <strong>10,000 credits</strong>.</p>
              <p>🔄 Playwright crawls interactive elements automatically up to 10-20 steps.</p>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%' }}
              onClick={handleRunQa}
              disabled={qaStatus === 'running'}
            >
              {qaStatus === 'running' ? 'Crawl Running...' : 'Execute QA Test'}
            </button>
          </div>
        </div>

        <div>
          <div className="card" style={{ minHeight: '400px' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Crawl Execution Telemetry</h3>
            
            {qaStatus === 'idle' && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '5rem' }}>
                <Play size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                <p>Trigger a QA crawl to view real-time DOM exploration steps.</p>
              </div>
            )}

            {qaStatus === 'running' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-hover)', marginBottom: '1rem' }}>
                  <RefreshCw className="animate-spin" size={18} />
                  <span>Gemini and Playwright are exploring DOM structures...</span>
                </div>
                <div className="timeline">
                  {qaSteps.map((step, idx) => (
                    <div className="timeline-step" key={idx}>
                      <div className="timeline-dot"></div>
                      <div className="timeline-header">
                        <span className="timeline-action">Step {step.step}: {step.action}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{step.url}</span>
                      </div>
                      <div className="timeline-desc">
                        {step.error ? (
                          <span style={{ color: 'var(--error)' }}>Error: {step.error}</span>
                        ) : (
                          <>
                            <strong>Selector</strong>: <code>{step.selector}</code> {step.text && <span>| <strong>Input</strong>: "{step.text}"</span>}<br/>
                            <strong>Reasoning</strong>: {step.reason}
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
                  <span>AI QA Crawl completed successfully!</span>
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
