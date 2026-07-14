import React, { useState, useEffect, useRef } from 'react';
import { Play, CheckCircle, AlertCircle, RefreshCw, Globe, Monitor, Terminal, FileText, Ticket, Video, Activity, Layout, Eye, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import apiClient from "../api/client";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';
import { startUIUXTest, getUIUXTestStatus, UIUXTestStepData, UIUXTestStatusResponse, UIUXTestDefect, UIUXTestScores } from '../api/UIUXTestApi';
import Button from '../components/common/Button';
import TextField from '../components/common/TextField';
import CustomVideoPlayer from '../components/video/CustomVideoPlayer';
import UIUXScoreRadarChart from '../components/dashboard/UIUXScoreRadarChart';
import UIUXScoreBarChart from '../components/dashboard/UIUXScoreBarChart';
interface Domain {
  id: number;
  domainUrl: string;
  verified: boolean;
}

import { useUserStore } from '../store/userStore';
import { useAlertStore } from '../store/alertStore';
import { useDomains } from '../hooks/useDomains';

interface UIUXTestPageProps {
  selectedUIUXTestDomain: number;
  setSelectedUIUXTestDomain: (id: number) => void;
  onAddLedger: (ledgerItem: any) => void;
}


export default function UIUXTestPage({
  selectedUIUXTestDomain,
  setSelectedUIUXTestDomain,
  onAddLedger,
}: UIUXTestPageProps) {
  const currentUser = useUserStore((state) => state.currentUser);
  const onUserUpdate = useUserStore((state) => state.updateUserBalanceAndCoupons);
  const showAlert = useAlertStore((state) => state.showAlert);
  const { domains } = useDomains();
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [UIUXTestStatus, setUIUXTestStatus] = useState<string>('idle');
  const [UIUXTestSteps, setUIUXTestSteps] = useState<UIUXTestStepData[]>([]);
  const [reportData, setReportData] = useState<UIUXTestStatusResponse | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollErrorCountRef = useRef(0);
  const pollCountRef = useRef(0);
  const isSubmittingRef = useRef(false);
  const stepsEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [activeDefectId, setActiveDefectId] = useState<number | null>(null);
  const [showHeuristics, setShowHeuristics] = useState(false);

  useEffect(() => {
    if (stepsEndRef.current) {
      stepsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [UIUXTestSteps]);

  const stopPolling = React.useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const selected = domains.find(d => d.id === selectedUIUXTestDomain);
    if (selected) {
      setTargetUrl(selected.domainUrl);
    }
  }, [selectedUIUXTestDomain, domains]);

  useEffect(() => {
    return () => { stopPolling(); };
  }, [stopPolling]);

  const handleRunUIUXTest = async () => {
    if (isSubmittingRef.current) {
      showAlert('이미 테스트 요청이 처리 중입니다. 잠시 기다려 주세요.', 'error');
      return;
    }
    if (UIUXTestStatus === 'running') {
      showAlert('테스트가 이미 실행 중입니다.', 'error');
      return;
    }

    if (!targetUrl.trim()) {
      showAlert('테스트할 웹사이트 URL을 입력해 주세요.', 'error');
      return;
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      showAlert('올바른 URL 형식(http:// 또는 https://)으로 입력해 주세요.', 'error');
      return;
    }

    if (currentUser.UIUXTestCoupons <= 0 && currentUser.balance < 1000) {
      showAlert('UI/UX 테스트 쿠폰 또는 크레딧 잔액이 부족합니다.', 'error');
      return;
    }

    setUIUXTestStatus('running');
    setUIUXTestSteps([]);
    setReportData(null);
    isSubmittingRef.current = true;

    try {
      const startRes = await startUIUXTest(targetUrl);
      const requestId = startRes.requestId;

      showAlert('자율형 AI UI 테스트 탐색 에이전트가 가동되었습니다!', 'success');

      try {
        const mypageRes = await apiClient.get('/api/mypage');
        onUserUpdate({
          balance: mypageRes.data.balance,
          coupons: mypageRes.data.couponCount,
          loadTestCoupons: mypageRes.data.loadTestCouponCount,
          UIUXTestCoupons: mypageRes.data.UIUXTestCouponCount
        });
      } catch (err) {
        console.error('Failed to sync user state:', err);
      }

      stopPolling();
      pollErrorCountRef.current = 0;
      pollCountRef.current = 0;
      const MAX_POLL_ERRORS = 5;
      const MAX_POLL_COUNT = 480;

      intervalRef.current = setInterval(async () => {
        pollCountRef.current += 1;

        if (pollCountRef.current > MAX_POLL_COUNT) {
          stopPolling();
          setUIUXTestStatus('error');
          showAlert('테스트 응답 대기 시간이 초과되었습니다.', 'error');
          return;
        }

        try {
          const statusRes = await getUIUXTestStatus(requestId);
          pollErrorCountRef.current = 0;
          setUIUXTestSteps(statusRes.steps || []);

          if (statusRes.status === 'COMPLETED') {
            stopPolling();
            setUIUXTestStatus('success');
            setReportData(statusRes);
            showAlert('자율형 AI UI 테스트가 완료되었습니다!', 'success');
          } else if (statusRes.status === 'FAILED') {
            stopPolling();
            setUIUXTestStatus('error');
            showAlert('AI UI 테스트 도중 에러가 발생하였습니다.', 'error');
          }
        } catch (pollErr) {
          pollErrorCountRef.current += 1;
          if (pollErrorCountRef.current >= MAX_POLL_ERRORS) {
            stopPolling();
            setUIUXTestStatus('error');
            showAlert('서버 통신 오류로 상태 조회가 중단되었습니다.', 'error');
          }
        }
      }, 1500);

    } catch (err: any) {
      setUIUXTestStatus('error');
      let errorMessage = 'AI 서버를 호출하지 못했습니다.';
      if (err.response && err.response.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      showAlert(errorMessage, 'error');
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleVideoTimeUpdate = (currentTime: number) => {
    if (!reportData?.defects) return;
    
    // Find the closest defect within a 2-second window
    let currentDefect = reportData.defects.find(d => 
      Math.abs(d.timestampOffset - currentTime) < 1.0
    );
    
    setActiveDefectId(currentDefect?.id || null);
  };

  const customVideoRef = useRef<any>(null);

  const handleDefectClick = (offset: number) => {
    setActiveDefectId(reportData?.defects?.find(d => d.timestampOffset === offset)?.id || null);
    if (customVideoRef.current) {
      customVideoRef.current.seekTo(offset);
    }
  };

  const formatTimeForDisplay = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div style={{ textAlign: 'left', paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', margin: 0 }}>AI 자율형 UI 테스트 익스플로러 (Playwright + Gemini)</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 2.6fr 0.6fr', gap: '1.5rem', marginBottom: '2rem', alignItems: 'stretch' }}>
        {/* Column 1: Start Form */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>AI UI 테스트 시작</h3>
            <div className="form-group">
              <label className="form-label">인증 도메인 불러오기</label>
              <select
                className="form-input"
                value={selectedUIUXTestDomain}
                onChange={(e) => setSelectedUIUXTestDomain(parseInt(e.target.value))}
                disabled={UIUXTestStatus === 'running'}
              >
                <option value="">-- 주소 선택하기 --</option>
                {domains.filter(d => d.verified).map(d => (
                  <option key={d.id} value={d.id}>{d.domainUrl}</option>
                ))}
              </select>
            </div>

            <TextField
              label="테스트 대상 URL 주소"
              type="text"
              placeholder="https://example.com"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              disabled={UIUXTestStatus === 'running'}
              leftIcon={Globe}
              style={{ marginTop: '0.25rem' }}
            />

            <div style={{
              background: 'var(--bg-tertiary)',
              border: `1.5px solid ${currentUser.UIUXTestCoupons > 0 ? 'var(--accent)' : currentUser.balance >= 1000 ? '#f59e0b' : '#ef4444'}`,
              borderRadius: '0.75rem',
              padding: '1rem 1.25rem',
              marginTop: '1.25rem',
              marginBottom: '1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>🎟️ 보유 현황</span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  background: currentUser.UIUXTestCoupons > 0 ? 'rgba(99,102,241,0.15)' : currentUser.balance >= 1000 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                  color: currentUser.UIUXTestCoupons > 0 ? 'var(--accent)' : currentUser.balance >= 1000 ? '#f59e0b' : '#ef4444',
                }}>
                  {currentUser.UIUXTestCoupons > 0 ? '쿠폰으로 차감' : currentUser.balance >= 1000 ? '크레딧으로 차감' : '잔액 부족'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '0.5rem', padding: '0.6rem 0.8rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>UI/UX 테스트 쿠폰</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: currentUser.UIUXTestCoupons > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {currentUser.UIUXTestCoupons}회
                  </div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '0.5rem', padding: '0.6rem 0.8rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>크레딧 잔액</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: currentUser.balance >= 1000 ? 'var(--text-primary)' : '#ef4444' }}>
                    {currentUser.balance.toLocaleString()}P
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
                {currentUser.UIUXTestCoupons > 0
                  ? <>이번 테스트에 <strong style={{ color: 'var(--accent)' }}>UI/UX 테스트 쿠폰 1회</strong>가 소모됩니다. (잔여 {currentUser.UIUXTestCoupons - 1}회)</>
                  : <>이번 테스트에 <strong style={{ color: '#f59e0b' }}>1,000 크레딧</strong>이 소모됩니다.</>
                }
              </div>
            </div>

            <Button
              variant="primary"
              style={{ width: '100%', marginTop: 'auto' }}
              onClick={handleRunUIUXTest}
              isLoading={UIUXTestStatus === 'running'}
              loadingText="에이전트 구동 중..."
              icon={Play}
            >
              <span>UI 테스트 시작</span>
            </Button>
          </div>
        </div>

        {/* Column 2: Live Video Stream */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '2px solid var(--border)' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Monitor size={16} /> 실시간 탐색 스트림 (Live VNC)
            </div>
            <div style={{ flex: 1, backgroundColor: '#000', position: 'relative', minHeight: '350px' }}>
              {UIUXTestStatus === 'running' ? (
                <iframe 
                  src={UIUXTestSteps.find(step => step.vncUrl)?.vncUrl || "http://localhost:6080/vnc.html?autoconnect=true&resize=scale"} 
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} 
                  title="Live Test Stream"
                  allowFullScreen
                />
              ) : (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <Video size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                  <div style={{ width: '100%', textAlign: 'center', fontSize: '0.9rem' }}>오프라인 (테스트를 시작해주세요)</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Column 3: Telemetry */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem', backgroundColor: 'var(--bg-primary)' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
              <Terminal size={14} style={{ color: 'var(--text-secondary)' }} />
              <span>로그</span>
            </h3>
            <div className="timeline" style={{ flex: 1, overflowY: 'auto', maxHeight: '350px', paddingRight: '0.2rem' }}>
              {UIUXTestStatus === 'running' && UIUXTestSteps.length === 0 && (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem', fontSize: '0.8rem' }}>
                  <RefreshCw className="animate-spin" size={20} style={{ margin: '0 auto 0.5rem', opacity: 0.5, display: 'block' }} />
                  <p>초기화 중...</p>
                </div>
              )}
              {UIUXTestSteps.map((step, idx) => (
                <div key={idx} style={{ 
                  marginBottom: '0.5rem', 
                  padding: '0.5rem', 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderLeft: '3px solid var(--accent)', 
                  borderRadius: '0 0.4rem 0.4rem 0',
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  <strong style={{ color: 'var(--accent)' }}>스텝 {step.step}:</strong> {step.action}
                </div>
              ))}
              <div ref={stepsEndRef} />
            </div>
          </div>
        </div>
      </div>

      {(UIUXTestStatus === 'success' || UIUXTestStatus === 'running') && (
        <div style={{ marginTop: '2rem', animation: 'fadeIn 0.5s ease-out' }}>
          {UIUXTestStatus === 'success' && reportData && (
            <>
              <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={24} style={{ color: 'var(--accent)' }}/> 4대 스코어 대시보드
              </h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem', alignItems: 'center' }}>
                <div style={{ padding: '0', background: 'transparent' }}>
                  <UIUXScoreRadarChart scores={reportData.scores!} />
                </div>
                <div style={{ padding: '0', background: 'transparent' }}>
                  <UIUXScoreBarChart scores={reportData.scores!} />
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginBottom: '2rem', alignItems: 'stretch' }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                최종 결과 비디오 (Interactive Timeline)
              </div>
              <div style={{ flex: 1, backgroundColor: '#000', display: 'flex', minHeight: '400px' }}>
                {reportData?.videoUrl ? (
                  <CustomVideoPlayer 
                    ref={customVideoRef}
                    src={reportData.videoUrl}
                    defects={reportData.defects}
                    activeDefectId={activeDefectId}
                    onTimeUpdate={handleVideoTimeUpdate}
                    onDefectClick={(offset) => {
                      setActiveDefectId(reportData.defects?.find(d => d.timestampOffset === offset)?.id || null);
                      if (customVideoRef.current) customVideoRef.current.seekTo(offset);
                    }}
                  />
                ) : (
                  <div style={{ padding: '3rem', width: '100%', textAlign: 'center', color: 'var(--text-muted)', alignSelf: 'center' }}>
                    비디오 기록이 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginBottom: '1rem' }}>결함 타임라인</h3>
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '500px', paddingRight: '0.5rem' }}>
                {UIUXTestStatus === 'running' ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
                    <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 1rem', opacity: 0.5, display: 'block' }} />
                    <p>테스트 진행 중... 실시간으로 결함을 분석합니다.</p>
                  </div>
                ) : reportData?.defects && reportData.defects.length > 0 ? reportData.defects.map(defect => (
                  <div 
                    key={defect.id} 
                    onClick={() => handleDefectClick(defect.timestampOffset)}
                    style={{ 
                      padding: '1.25rem', 
                      marginBottom: '1rem', 
                      borderRadius: '0.75rem', 
                      cursor: 'pointer',
                      border: activeDefectId === defect.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                      backgroundColor: activeDefectId === defect.id ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                      boxShadow: activeDefectId === defect.id ? '0 4px 15px rgba(99, 102, 241, 0.15)' : 'none',
                      transform: activeDefectId === defect.id ? 'scale(1.02)' : 'scale(1)',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center' }}>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 800, 
                        padding: '0.2rem 0.6rem', 
                        borderRadius: '1rem',
                        backgroundColor: defect.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.1)' : defect.severity === 'MAJOR' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                        color: defect.severity === 'CRITICAL' ? '#ef4444' : defect.severity === 'MAJOR' ? '#f59e0b' : '#eab308',
                        border: `1px solid ${defect.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : defect.severity === 'MAJOR' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(234, 179, 8, 0.2)'}`
                      }}>
                        {defect.severity}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, background: 'var(--bg-tertiary)', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>
                        {formatTimeForDisplay(defect.timestampOffset)}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.4rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertCircle size={16} style={{ color: defect.severity === 'CRITICAL' ? '#ef4444' : defect.severity === 'MAJOR' ? '#f59e0b' : '#eab308' }} />
                      {defect.category}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{defect.description}</div>
                  </div>
                )) : (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>발견된 결함이 없습니다.</div>
                )}
              </div>
            </div>
          </div>

          {UIUXTestStatus === 'success' && reportData && (
            <div className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
              <div 
                style={{ padding: '1.25rem 1.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)', borderBottom: showHeuristics ? '1px solid var(--border)' : 'none' }}
                onClick={() => setShowHeuristics(!showHeuristics)}
              >
                <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} style={{ color: 'var(--accent)' }}/> 닐슨 10대 휴리스틱 상세 보고서
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>자세히 보기</span>
                  {showHeuristics ? <ChevronUp /> : <ChevronDown />}
                </div>
              </div>
              {showHeuristics && (
                <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-primary)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                    {reportData.report?.split('\n')
                      .filter(line => line.trim().startsWith('- ') && !line.includes('종합 사용성 점수') && !line.includes('특이사항 없음'))
                      .map((item, idx) => {
                        const content = item.replace(/^- /, '').trim();
                        if (!content) return null;
                        return (
                          <div key={idx} style={{ 
                            padding: '1.25rem', 
                            backgroundColor: 'var(--bg-secondary)', 
                            borderRadius: '0.75rem', 
                            border: '1px solid var(--border)',
                            display: 'flex',
                            gap: '1rem',
                            alignItems: 'flex-start'
                          }}>
                            <div style={{ padding: '0.5rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '0.5rem', color: 'var(--accent)' }}>
                              <Layout size={20} />
                            </div>
                            <div style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                              {content}
                            </div>
                          </div>
                        );
                      })}
                    {(!reportData.report || reportData.report.includes('특이사항 없음') || reportData.report.includes('평가 생성 중 오류')) && (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', width: '100%', gridColumn: '1 / -1' }}>
                        발견된 주요 사용성 위반 사항이 없거나 평가가 비활성화되었습니다.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
