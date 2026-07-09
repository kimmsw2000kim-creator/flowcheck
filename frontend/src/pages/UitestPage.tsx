import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, AlertCircle, RefreshCw, Globe, Monitor, Terminal, FileText, Ticket, Video } from 'lucide-react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { startUiTest, getUiTestStatus, UiTestStepData } from '../api/uiTestApi';
import Button from '../components/common/Button';
import TextField from '../components/common/TextField';

interface Domain {
  id: number;
  domainUrl: string;
  verified: boolean;
}

import { useUserStore } from '../store/userStore';
import { useAlertStore } from '../store/alertStore';

import { useDomains } from '../hooks/useDomains';

interface UiTestPageProps {
  selectedUiTestDomain: number;
  setSelectedUiTestDomain: (id: number) => void;
  onAddLedger: (ledgerItem: any) => void;
}

export default function UiTestPage({
  selectedUiTestDomain,
  setSelectedUiTestDomain,
  onAddLedger,
}: UiTestPageProps) {
  const currentUser = useUserStore((state) => state.currentUser);
  const onUserUpdate = useUserStore((state) => state.updateUserBalanceAndCoupons);
  const showAlert = useAlertStore((state) => state.showAlert);
  const { domains } = useDomains();
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [uiTestStatus, setUiTestStatus] = useState<string>('idle'); // idle, running, success, error
  const [uiTestSteps, setUiTestSteps] = useState<UiTestStepData[]>([]);
  const [uiTestReportMarkdown, setUiTestReportMarkdown] = useState<string>('');

  // ✅ interval ID를 useRef로 관리 — React 비동기 state와 무관하게 즉시 clearInterval 가능
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const pollErrorCountRef = React.useRef(0);
  const pollCountRef = React.useRef(0);

  // ✅ 제출 중 중복 클릭 방지 (React state보다 빠르게 동기적으로 차단)
  const isSubmittingRef = React.useRef(false);

  // ✅ 새로운 스텝 추가 시 자동 스크롤을 위한 Ref
  const stepsEndRef = React.useRef<HTMLDivElement>(null);

  // 스텝 배열이 갱신될 때마다 자동으로 스크롤 하단으로 이동
  useEffect(() => {
    if (stepsEndRef.current) {
      stepsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [uiTestSteps]);

  /** interval을 완전히 정지하는 헬퍼 함수 */
  const stopPolling = React.useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // 도메인 선택 변경 시 URL 입력창 자동 반영
  useEffect(() => {
    const selected = domains.find(d => d.id === selectedUiTestDomain);
    if (selected) {
      setTargetUrl(selected.domainUrl);
    }
  }, [selectedUiTestDomain, domains]);

  // 언마운트 시 폴링 리소스 정리
  useEffect(() => {
    return () => { stopPolling(); };
  }, [stopPolling]);

  const handleRunUiTest = async () => {
    // ✅ 이중 가드 1: 이미 제출 중이면 즉시 차단 (비동기 중복 클릭 방지)
    if (isSubmittingRef.current) {
      showAlert('이미 테스트 요청이 처리 중입니다. 잠시 기다려 주세요.', 'error');
      return;
    }
    // ✅ 이중 가드 2: 이미 running 상태면 추가 시작 불가
    if (uiTestStatus === 'running') {
      showAlert('테스트가 이미 실행 중입니다.', 'error');
      return;
    }

    if (!targetUrl.trim()) {
      showAlert('테스트할 웹사이트 URL을 입력해 주세요.', 'error');
      return;
    }

    // 간단한 URL 형식 검증
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      showAlert('올바른 URL 형식(http:// 또는 https://)으로 입력해 주세요.', 'error');
      return;
    }

    // 쿠폰/크레딧 체크 및 차감
    if (currentUser.uiUxTestCoupons <= 0 && currentUser.balance < 1000) {
      showAlert('UI/UX 테스트 쿠폰 또는 크레딧 잔액이 부족합니다.', 'error');
      return;
    }

    setUiTestStatus('running');
    setUiTestSteps([]);
    setUiTestReportMarkdown('');
    isSubmittingRef.current = true; // ✅ 제출 잠금

    try {
      // 2. 백엔드 호출
      const startRes = await startUiTest(targetUrl, currentUser.id);
      const requestId = startRes.requestId;
      
      showAlert('자율형 AI UI 테스트 탐색 에이전트가 가동되었습니다!', 'success');

      // 잔액/쿠폰 정보 갱신
      try {
        const mypageRes = await axios.get('/api/mypage');
        onUserUpdate({
          balance: mypageRes.data.balance,
          coupons: mypageRes.data.couponCount,
          loadTestCoupons: mypageRes.data.loadTestCouponCount,
          uiUxTestCoupons: mypageRes.data.uiUxTestCouponCount
        });
      } catch (err) {
        console.error('Failed to sync user state after starting UI test:', err);
      }

      // 3. 폴링 시작 (1.5초 주기)
      // ✅ 기존 interval이 살아있으면 먼저 정지
      stopPolling();
      pollErrorCountRef.current = 0;
      pollCountRef.current = 0;
      const MAX_POLL_ERRORS = 5;  // 연속 에러 5회 → 중단
      const MAX_POLL_COUNT = 480; // 최대 12분 (480 * 1.5s)

      intervalRef.current = setInterval(async () => {
        pollCountRef.current += 1;

        // 최대 폴링 횟수 초과 시 강제 중단
        if (pollCountRef.current > MAX_POLL_COUNT) {
          console.warn('Max polling count exceeded. Stopping polling.');
          stopPolling();
          setUiTestStatus('error');
          setUiTestReportMarkdown('# 타임아웃\n\n테스트가 12분 이상 응답이 없어 자동으로 중단되었습니다.');
          showAlert('테스트 응답 대기 시간이 초과되었습니다.', 'error');
          return;
        }

        try {
          const statusRes = await getUiTestStatus(requestId);
          pollErrorCountRef.current = 0; // 성공 시 에러 카운터 리셋
          setUiTestSteps(statusRes.steps);

          if (statusRes.status === 'COMPLETED') {
            stopPolling(); // ✅ ref 기반으로 즉시 중단
            setUiTestStatus('success');
            setUiTestReportMarkdown(statusRes.report || '');
            showAlert('자율형 AI UI 테스트가 완료되었습니다!', 'success');
          } else if (statusRes.status === 'FAILED') {
            stopPolling(); // ✅ ref 기반으로 즉시 중단
            setUiTestStatus('error');
            setUiTestReportMarkdown(statusRes.report || '# 테스트 실패\n\nAI 에이전트 탐색 중 비정상 종료되거나 에러가 발생했습니다.');
            showAlert('AI UI 테스트 도중 에러가 발생하였습니다.', 'error');
          }
        } catch (pollErr) {
          pollErrorCountRef.current += 1;
          console.error(`Status polling error (${pollErrorCountRef.current}/${MAX_POLL_ERRORS}):`, pollErr);

          // 연속 에러가 한도 초과 시 폴링 중단
          if (pollErrorCountRef.current >= MAX_POLL_ERRORS) {
            console.error('Too many consecutive polling errors. Stopping polling.');
            stopPolling(); // ✅ ref 기반으로 즉시 중단
            setUiTestStatus('error');
            setUiTestReportMarkdown('# 연결 오류\n\n서버와의 통신이 반복적으로 실패하여 테스트 상태 조회를 중단하였습니다.');
            showAlert('서버 통신 오류로 상태 조회가 중단되었습니다.', 'error');
          }
        }
      }, 1500);

    } catch (err: any) {
      console.error('Failed to start UI Test:', err);
      setUiTestStatus('error');
      showAlert(err.message || 'AI 서버를 호출하지 못했습니다.', 'error');
    } finally {
      isSubmittingRef.current = false; // ✅ 성공/실패 모두 잠금 해제
    }
  };

  // 비디오 녹화본 URL 추출 파싱 (백엔드 추가 컬럼 없이 report 내 마킹 데이터 활용)
  const hasVideoUrl = uiTestReportMarkdown.includes('[VIDEO_URL]:');
  let videoUrl = '';
  let cleanReportMarkdown = uiTestReportMarkdown;

  if (hasVideoUrl) {
    const parts = uiTestReportMarkdown.split('[VIDEO_URL]:');
    const afterTag = parts[1];
    const firstNewlineIdx = afterTag.indexOf('\n');
    
    if (firstNewlineIdx !== -1) {
      videoUrl = afterTag.substring(0, firstNewlineIdx).trim();
      // VIDEO_URL 태그 이후 첫 줄바꿈 다음부터가 실제 보고서 내용
      cleanReportMarkdown = (parts[0] + afterTag.substring(firstNewlineIdx)).trim();
    } else {
      videoUrl = afterTag.trim();
      cleanReportMarkdown = parts[0].trim();
    }
  }

  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', margin: 0 }}>AI 자율형 UI 테스트 익스플로러 (Playwright + Gemini)</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem', backgroundColor: 'var(--bg-secondary)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
          <Monitor size={14} style={{ color: 'var(--accent-hover)' }} />
          <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>로컬 브라우저 구동 모드 (headless=False)</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        <div>
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem' }}>AI UI 테스트 시작</h3>
            
            <div className="form-group">
              <label className="form-label">인증 도메인 불러오기</label>
              <select 
                className="form-input" 
                value={selectedUiTestDomain} 
                onChange={(e) => setSelectedUiTestDomain(parseInt(e.target.value))}
                disabled={uiTestStatus === 'running'}
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

            <TextField
              label="테스트 대상 URL 주소"
              type="text"
              placeholder="https://example.com"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              disabled={uiTestStatus === 'running'}
              leftIcon={Globe}
              style={{ marginTop: '0.25rem' }}
            />

            {/* 쿠폰 및 크레딧 현황 카드 */}
            <div style={{
              background: 'var(--bg-tertiary)',
              border: `1.5px solid ${currentUser.uiUxTestCoupons > 0 ? 'var(--accent)' : currentUser.balance >= 1000 ? '#f59e0b' : '#ef4444'}`,
              borderRadius: '0.75rem',
              padding: '1rem 1.25rem',
              marginBottom: '1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  <Ticket size={16} /> 보유 현황
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  background: currentUser.uiUxTestCoupons > 0 ? 'rgba(99,102,241,0.15)' : currentUser.balance >= 1000 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                  color: currentUser.uiUxTestCoupons > 0 ? 'var(--accent)' : currentUser.balance >= 1000 ? '#f59e0b' : '#ef4444',
                }}>
                  {currentUser.uiUxTestCoupons > 0 ? '쿠폰으로 차감' : currentUser.balance >= 1000 ? '크레딧으로 차감' : '잔액 부족'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '0.5rem', padding: '0.6rem 0.8rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>UI/UX 쿠폰</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: currentUser.uiUxTestCoupons > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {currentUser.uiUxTestCoupons}회
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
                {currentUser.uiUxTestCoupons > 0
                  ? <>이번 테스트에 <strong style={{ color: 'var(--accent)' }}>UI/UX 쿠폰 1회</strong>가 소모됩니다. (잔여 {currentUser.uiUxTestCoupons - 1}회)</>
                  : <>이번 테스트에 <strong style={{ color: '#f59e0b' }}>1,000 크레딧</strong>이 소모됩니다.</>
                }
              </div>
            </div>

            <Button 
              variant="primary" 
              style={{ width: '100%' }}
              onClick={handleRunUiTest}
              isLoading={uiTestStatus === 'running'}
              loadingText="탐색 에이전트 구동 중..."
              icon={Play}
            >
              <span>UI 테스트 시작</span>
            </Button>
          </div>
        </div>

        <div>
          <div className="card" style={{ minHeight: '450px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Terminal size={18} style={{ color: 'var(--text-secondary)' }} />
              <span>실시간 탐색 상황 (Telemetry)</span>
            </h3>
            
            {uiTestStatus === 'idle' && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 'auto' }}>
                <Play size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                <p>UI/UX 테스트를 시작하면 실시간 DOM 탐색 진행 상황이 표시됩니다.</p>
              </div>
            )}

            {uiTestStatus === 'running' && uiTestSteps.length === 0 && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 'auto' }}>
                <RefreshCw className="animate-spin" size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p>브라우저를 초기화하고 대상 주소로 이동하는 중입니다...</p>
              </div>
            )}

            {(uiTestStatus === 'running' || uiTestSteps.length > 0) && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {uiTestStatus === 'running' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-hover)', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                    <RefreshCw className="animate-spin" size={16} />
                    <span>Gemini AI와 Playwright가 화면 구조를 파악하고 이벤트를 유도하고 있습니다.</span>
                  </div>
                )}
                
                <div className="timeline" style={{ flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
                  {uiTestSteps.map((step, idx) => (
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
                  <div ref={stepsEndRef} />
                </div>

                {uiTestStatus === 'success' && (
                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                    <div style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <CheckCircle size={18} />
                      <span>자율형 AI UI 테스트가 완료되었습니다! 아래 종합 리포트를 확인해 주세요.</span>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                        <FileText size={18} />
                        <h4 style={{ margin: 0 }}>Gemini UI/UX 종합 감사 보고서</h4>
                      </div>
                      
                      {videoUrl && (
                        <div style={{ marginBottom: '1.5rem', border: '1px solid var(--border)', borderRadius: '0.5rem', overflow: 'hidden', backgroundColor: '#000000' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            <Video size={16} /> AI 탐색 테스트 녹화 비디오 (Supabase Storage)
                          </div>
                          <video src={videoUrl} controls width="100%" style={{ display: 'block', maxHeight: '500px', margin: '0 auto' }} />
                        </div>
                      )}

                      <div style={{
                        fontSize: '0.9rem',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.8',
                      }} className="report-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {cleanReportMarkdown}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}

                {uiTestStatus === 'error' && (
                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                    <div style={{ color: 'var(--error)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <AlertCircle size={18} />
                      <span>테스트 실행에 실패하였습니다.</span>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                      <div style={{
                        fontSize: '0.9rem',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.8',
                      }} className="report-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {cleanReportMarkdown}
                        </ReactMarkdown>
                      </div>
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
