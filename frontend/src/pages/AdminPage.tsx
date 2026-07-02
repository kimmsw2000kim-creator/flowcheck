import React, { useState } from 'react';
import { RefreshCw, LineChart as ChartIcon } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface Report {
  id: number;
  reporterId: string;
  targetType: string;
  targetId: number;
  reason: string;
  status: string;
  createdAt: string;
}

interface Inquiry {
  id: number;
  userId: string;
  title: string;
  content: string;
  status: string;
  answer: string | null;
  createdAt: string;
}

interface DailyStat {
  date: string;
  totalUsers: number;
  newUsers: number;
  totalVerifiedDomains: number;
  totalTestsRun: number;
  totalCreditsConsumed: number;
  retentionRate7d: number;
}

interface AdminPageProps {
  currentUser: {
    role: string;
    id: string;
    email: string;
  };
  reports: Report[];
  setReports: (reps: Report[]) => void;
  handleSuspendUser: (targetId: string) => void;
  showAlert: (msg: string, type?: string) => void;
}

export default function AdminPage({
  currentUser,
  reports,
  setReports,
  handleSuspendUser,
  showAlert
}: AdminPageProps) {
  const [inquiries, setInquiries] = useState<Inquiry[]>([
    { id: 1, userId: 'f87a32d1-921c-4b9b-90f3-cb2071850123', title: 'Payment Webhook Delay', content: 'I deposited 50,000 KRW to the virtual account, but it took 10 minutes to update.', status: 'PENDING', answer: null, createdAt: '2026-06-30' }
  ]);
  const [newInquiryTitle, setNewInquiryTitle] = useState<string>('');
  const [newInquiryContent, setNewInquiryContent] = useState<string>('');
  const [newAdminAnswer, setNewAdminAnswer] = useState<string>('');

  const [dailyStats] = useState<DailyStat[]>([
    { date: '2026-06-24', totalUsers: 142, newUsers: 12, totalVerifiedDomains: 23, totalTestsRun: 110, totalCreditsConsumed: 450000, retentionRate7d: 38.5 },
    { date: '2026-06-25', totalUsers: 154, newUsers: 12, totalVerifiedDomains: 25, totalTestsRun: 125, totalCreditsConsumed: 520000, retentionRate7d: 41.2 },
    { date: '2026-06-26', totalUsers: 168, newUsers: 14, totalVerifiedDomains: 28, totalTestsRun: 140, totalCreditsConsumed: 600000, retentionRate7d: 40.8 },
    { date: '2026-06-27', totalUsers: 180, newUsers: 12, totalVerifiedDomains: 31, totalTestsRun: 165, totalCreditsConsumed: 580000, retentionRate7d: 42.5 },
    { date: '2026-06-28', totalUsers: 195, newUsers: 15, totalVerifiedDomains: 33, totalTestsRun: 190, totalCreditsConsumed: 700000, retentionRate7d: 44.1 },
    { date: '2026-06-29', totalUsers: 210, newUsers: 15, totalVerifiedDomains: 36, totalTestsRun: 210, totalCreditsConsumed: 850000, retentionRate7d: 45.0 }
  ]);

  const handleCreateInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInquiryTitle || !newInquiryContent) return;
    const inquiry: Inquiry = {
      id: inquiries.length + 1,
      userId: currentUser.id,
      title: newInquiryTitle,
      content: newInquiryContent,
      status: 'PENDING',
      answer: null,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setInquiries([...inquiries, inquiry]);
    setNewInquiryTitle('');
    setNewInquiryContent('');
    showAlert('고객 문의가 등록되었습니다.');
  };

  const handleAnswerInquiry = (id: number) => {
    if (!newAdminAnswer) return;
    setInquiries(inquiries.map(inq => inq.id === id ? { ...inq, status: 'ANSWERED', answer: newAdminAnswer } : inq));
    setNewAdminAnswer('');
    showAlert('답변이 등록되었습니다.');
  };
  return (
    <div style={{ textAlign: 'left' }}>
      <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>관리 정책, 고객 지원 및 통계 분석</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
        <div>
          {currentUser.role === 'ADMIN' ? (
            // Admin Moderation controls
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>신고 접수 및 콘텐츠 피드 관리</h3>
                <div className="table-wrapper">
                  <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>구분</th>
                        <th>대상 ID</th>
                        <th>신고 사유</th>
                        <th>조치 조작</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map(rep => (
                        <tr key={rep.id}>
                          <td><span className="badge badge-pending">{rep.targetType}</span></td>
                          <td>{rep.targetId}</td>
                          <td>{rep.reason}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                onClick={() => handleSuspendUser('f87a32d1-921c-4b9b-90f3-cb2071850123')}
                              >
                                작성자 정지
                              </button>
                              <button 
                                className="btn btn-success" 
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                onClick={() => setReports(reports.filter(r => r.id !== rep.id))}
                              >
                                신고 반려
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {reports.length === 0 && (
                        <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>대기 중인 신고 내역이 없습니다.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>일일 플랫폼 운영 성능 (7일 리텐션)</h3>
                <button className="btn btn-primary" style={{ marginBottom: '1rem' }} onClick={() => showAlert('금일 플랫폼 운영 지표 및 데일리 집계가 업데이트되었습니다.', 'success')}>
                  배치 통계 집계 실행
                </button>

                <div style={{ height: '220px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" stroke="var(--text-muted)" />
                      <YAxis stroke="var(--accent)" />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }} />
                      <Legend />
                      <Line type="monotone" dataKey="retentionRate7d" name="7일 리텐션 비율 (%)" stroke="var(--success)" activeDot={{ r: 8 }} />
                      <Line type="monotone" dataKey="totalTestsRun" name="일일 누적 테스트 횟수" stroke="var(--accent)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            // User CS submission
            <div className="card">
              <h3 style={{ marginBottom: '1.25rem' }}>1:1 고객 문의 제출</h3>
              <form onSubmit={handleCreateInquiry}>
                <div className="form-group">
                  <label className="form-label">제목</label>
                  <input type="text" className="form-input" placeholder="문의 제목을 입력하세요..." value={newInquiryTitle} onChange={(e) => setNewInquiryTitle(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">문의 내용</label>
                  <textarea className="form-input" rows={5} placeholder="결제 오류, 부하 테스트 실패, 쿠폰 발급 건 등 문의하실 상세 내용을 기입해주세요..." value={newInquiryContent} onChange={(e) => setNewInquiryContent(e.target.value)} required></textarea>
                </div>
                <button type="submit" className="btn btn-primary">문의하기</button>
              </form>
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>1:1 고객 문의 내역 및 답변</h3>
            
            {currentUser.role === 'ADMIN' ? (
              // Admin inquiry response view
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {inquiries.map(inq => (
                  <div key={inq.id} style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      <span>작성 유저: {inq.userId.substring(0, 8)}...</span>
                      <span>{inq.createdAt}</span>
                    </div>
                    <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{inq.title}</h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>{inq.content}</p>
                    
                    {inq.status === 'PENDING' ? (
                      <div>
                        <textarea 
                          className="form-input" 
                          placeholder="답변 내용을 작성하세요..." 
                          value={newAdminAnswer} 
                          onChange={(e) => setNewAdminAnswer(e.target.value)}
                          style={{ marginBottom: '0.5rem' }}
                        ></textarea>
                        <button className="btn btn-primary" onClick={() => handleAnswerInquiry(inq.id)}>
                          답변 등록
                        </button>
                      </div>
                    ) : (
                      <div style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderLeft: '2px solid var(--success)', borderRadius: '0.25rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)' }}>관리자 답변:</div>
                        <p style={{ fontSize: '0.9rem' }}>{inq.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
                {inquiries.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>접수된 고객 문의가 없습니다.</div>
                )}
              </div>
            ) : (
              // User inquiry list view
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {inquiries.filter(i => i.userId === currentUser.id).map(inq => (
                  <div key={inq.id} style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      <span>답변 상태: <span className={inq.status === 'ANSWERED' ? 'badge badge-success' : 'badge badge-pending'}>{inq.status === 'ANSWERED' ? '답변완료' : '대기중'}</span></span>
                      <span>{inq.createdAt}</span>
                    </div>
                    <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{inq.title}</h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{inq.content}</p>
                    
                    {inq.answer && (
                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderLeft: '2px solid var(--success)', borderRadius: '0.25rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', marginBottom: '0.25rem' }}>답변:</div>
                        <p style={{ fontSize: '0.9rem' }}>{inq.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
                {inquiries.filter(i => i.userId === currentUser.id).length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>작성하신 고객 문의 내역이 없습니다.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
