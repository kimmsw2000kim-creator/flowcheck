import React, { useState } from 'react';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import axios from 'axios';

interface Domain {
  id: number;
  domainUrl: string;
  verified: boolean;
}

interface LoadChartDataPoint {
  time: string;
  users: number;
  tps: number;
  avg_response: number;
}

interface LoadMetrics {
  maxTps: number;
  avgResponse: number;
  errorRate: number;
  bottleneckDiagnosis: string;
}

interface LoadPageProps {
  domains: Domain[];
  currentUser: {
    id: string;
    coupons: number;
    balance: number;
  };
  onUserUpdate: (updatedUser: { coupons: number; balance: number }) => void;
  onAddLedger: (ledgerItem: any) => void;
  showAlert: (message: string, type?: string) => void;
}

export default function LoadPage({
  domains,
  currentUser,
  onUserUpdate,
  onAddLedger,
  showAlert
}: LoadPageProps) {
  const verifiedDomains = domains.filter(d => d.verified);
  const initialDomainId = verifiedDomains.length > 0 ? verifiedDomains[0].id : 1;

  const [selectedLoadDomain, setSelectedLoadDomain] = useState<number>(initialDomainId);
  const [vusers, setVusers] = useState<number>(100);
  const [duration, setDuration] = useState<number>(30);
  const [loadPrompt, setLoadPrompt] = useState<string>('Simulate multiple checkouts under extreme concurrency');
  const [loadStatus, setLoadStatus] = useState<string>('idle'); // idle, running, success, error
  const [loadMetrics, setLoadMetrics] = useState<LoadMetrics | null>(null);
  const [loadChartData, setLoadChartData] = useState<LoadChartDataPoint[]>([]);

  const handleRunLoadTest = async () => {
    if (currentUser.coupons <= 0 && currentUser.balance < 10000) {
      showAlert('쿠폰 또는 크레딧 잔액이 부족합니다.', 'error');
      return;
    }

    const targetUrl = domains.find(d => d.id === selectedLoadDomain)?.domainUrl || 'https://myshop.com';

    const payload = {
      targetUrl,
      vusers,
      duration,
      loadPrompt,
    };

    setLoadStatus('running');

    try {
      const response = await axios.post("/api/test/loadtest/run", payload, {
        headers: {
          'X-User-Id': currentUser.id,
        }
      });

      const {
        testResults,
        updatedUser,
        deductionDetail
      } = response.data;

      onUserUpdate({
        coupons: updatedUser.coupons,
        balance: updatedUser.balance
      });

      if (deductionDetail?.type === 'BALANCE') {
        onAddLedger({
          id: deductionDetail.ledgerId || Date.now(),
          amount: -10000,
          type: 'TEST_CONSUME',
          description: 'Locust 부하 테스트 실행',
          createdAt: new Date().toISOString().substring(0, 16)
        });
      }

      setLoadStatus('success');
      setLoadMetrics({
        maxTps: testResults.maxTps,
        avgResponse: testResults.avgResponse,
        errorRate: testResults.errorRate,
        bottleneckDiagnosis: testResults.bottleneckDiagnosis
      });
      setLoadChartData(testResults.points);

      showAlert('Locust 부하 테스트가 완료되었습니다!', 'success');

    } catch (error) {
      console.error('Failed to run load test:', error);
      setLoadStatus('error');

      if (axios.isAxiosError(error) && error.response) {
        showAlert(error.response.data.message || '서버 요청 중 오류가 발생했습니다.', 'error');
      } else {
        showAlert('알 수 없는 네트워크 오류가 발생했습니다.', 'error');
      }
    }
  };
  return (
    <div style={{ textAlign: 'left' }}>
      <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Locust 지능형 부하 테스트 엔진</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '2rem' }}>
        <div>
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem' }}>부하 테스트 구성</h3>
 
            <div className="form-group">
              <label className="form-label">대상 웹사이트</label>
              <select 
                className="form-input" 
                value={selectedLoadDomain} 
                onChange={(e) => setSelectedLoadDomain(parseInt(e.target.value))}
              >
                {domains.filter(d => d.verified).map(d => (
                  <option key={d.id} value={d.id}>{d.domainUrl}</option>
                ))}
              </select>
            </div>
 
            <div className="form-group">
              <label className="form-label">가상 동시 사용자 (VUsers): {vusers}명</label>
              <input 
                type="range" 
                min="10" 
                max="500" 
                step="10"
                value={vusers} 
                onChange={(e) => setVusers(parseInt(e.target.value))}
                style={{ accentColor: 'var(--accent)' }}
              />
            </div>
 
            <div className="form-group">
              <label className="form-label">테스트 실행 시간: {duration}초</label>
              <input 
                type="range" 
                min="10" 
                max="120" 
                step="10"
                value={duration} 
                onChange={(e) => setDuration(parseInt(e.target.value))}
                style={{ accentColor: 'var(--accent)' }}
              />
            </div>
 
            <div className="form-group">
              <label className="form-label">시나리오 요구사항 (프롬프트 입력)</label>
              <textarea 
                className="form-input" 
                rows={3} 
                value={loadPrompt.toString()}
                onChange={(e) => setLoadPrompt(e.target.value)}
              ></textarea>
            </div>
 
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={handleRunLoadTest}
              disabled={loadStatus === 'running'}
            >
              {loadStatus === 'running' ? '부하 테스트 실행 중...' : '테스트 시나리오 생성 및 실행'}
            </button>
          </div>
        </div>
 
        <div>
          <div className="card" style={{ minHeight: '400px' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>테스트 분석 지표 및 실시간 차트</h3>
 
            {loadStatus === 'idle' && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '6rem' }}>
                <TrendingUp size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                <p>Gemini AI가 Locust 테스트 스크립트를 동적으로 설계하고 헤드리스로 구동합니다.</p>
              </div>
            )}
 
            {loadStatus === 'running' && (
              <div style={{ textAlign: 'center', paddingTop: '5rem' }}>
                <RefreshCw className="animate-spin" size={40} style={{ margin: '0 auto 1.5rem', color: 'var(--accent)' }} />
                <p>Gemini AI가 locustfile.py를 자동 작성하고 트래픽 시뮬레이션을 생성하는 중입니다...</p>
              </div>
            )}
 
            {loadStatus === 'success' && loadMetrics && (
              <div>
                <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>최대 초당 처리량 (Max TPS)</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{loadMetrics.maxTps.toFixed(1)} req/s</div>
                  </div>
                  <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>평균 응답 속도</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{loadMetrics.avgResponse.toFixed(0)} ms</div>
                  </div>
                  <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>에러율</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: loadMetrics.errorRate > 0 ? 'var(--error)' : 'var(--success)' }}>
                      {loadMetrics.errorRate.toFixed(1)}%
                    </div>
                  </div>
                </div>
 
                {/* Line Chart */}
                <div style={{ height: '300px', width: '100%', marginBottom: '2rem' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={loadChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="time" stroke="var(--text-muted)" />
                      <YAxis yAxisId="left" stroke="var(--accent)" />
                      <YAxis yAxisId="right" orientation="right" stroke="var(--success)" />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="avg_response" name="평균 응답 시간 (ms)" stroke="var(--accent)" activeDot={{ r: 8 }} />
                      <Line yAxisId="right" type="monotone" dataKey="tps" name="초당 처리량 (TPS)" stroke="var(--success)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
 
                <div className="markdown-body" style={{ background: 'var(--bg-tertiary)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{loadMetrics.bottleneckDiagnosis}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
