import React from 'react';
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
  inquiries: Inquiry[];
  setInquiries: (inqs: Inquiry[]) => void;
  newInquiryTitle: string;
  setNewInquiryTitle: (t: string) => void;
  newInquiryContent: string;
  setNewInquiryContent: (c: string) => void;
  newAdminAnswer: string;
  setNewAdminAnswer: (a: string) => void;
  dailyStats: DailyStat[];
  handleSuspendUser: (targetId: string) => void;
  handleAnswerInquiry: (id: number) => void;
  handleCreateInquiry: (e: React.FormEvent) => void;
  showAlert: (msg: string, type?: string) => void;
}

export default function AdminPage({
  currentUser,
  reports,
  setReports,
  inquiries,
  setInquiries,
  newInquiryTitle,
  setNewInquiryTitle,
  newInquiryContent,
  setNewInquiryContent,
  newAdminAnswer,
  setNewAdminAnswer,
  dailyStats,
  handleSuspendUser,
  handleAnswerInquiry,
  handleCreateInquiry,
  showAlert
}: AdminPageProps) {
  return (
    <div style={{ textAlign: 'left' }}>
      <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Governance, Support & Analytics Dashboard</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
        <div>
          {currentUser.role === 'ADMIN' ? (
            // Admin Moderation controls
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>Report Feed Moderation</h3>
                <div className="table-wrapper">
                  <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Target ID</th>
                        <th>Reason</th>
                        <th>Actions</th>
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
                                Suspend Author
                              </button>
                              <button 
                                className="btn btn-success" 
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                onClick={() => setReports(reports.filter(r => r.id !== rep.id))}
                              >
                                Dismiss
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {reports.length === 0 && (
                        <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No pending abuse reports.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>Daily Platform Performance batch (7D Retention)</h3>
                <button className="btn btn-primary" style={{ marginBottom: '1rem' }} onClick={() => showAlert('Platform Daily Aggregations updated for LocalDate.now().', 'success')}>
                  Trigger Batch Statistic Calculation
                </button>

                <div style={{ height: '220px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" stroke="var(--text-muted)" />
                      <YAxis stroke="var(--accent)" />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }} />
                      <Legend />
                      <Line type="monotone" dataKey="retentionRate7d" name="7D Retention Rate (%)" stroke="var(--success)" activeDot={{ r: 8 }} />
                      <Line type="monotone" dataKey="totalTestsRun" name="Total Daily Tests Run" stroke="var(--accent)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            // User CS submission
            <div className="card">
              <h3 style={{ marginBottom: '1.25rem' }}>Submit 1:1 CS Inquiry</h3>
              <form onSubmit={handleCreateInquiry}>
                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <input type="text" className="form-input" placeholder="Brief subject details..." value={newInquiryTitle} onChange={(e) => setNewInquiryTitle(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Inquiry Message</label>
                  <textarea className="form-input" rows={5} placeholder="Detail your billing error, test failure, or coupon issue..." value={newInquiryContent} onChange={(e) => setNewInquiryContent(e.target.value)} required></textarea>
                </div>
                <button type="submit" className="btn btn-primary">Submit CS Ticket</button>
              </form>
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>1:1 Inquiry Tickets & Answers</h3>
            
            {currentUser.role === 'ADMIN' ? (
              // Admin inquiry response view
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {inquiries.map(inq => (
                  <div key={inq.id} style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      <span>Author: {inq.userId.substring(0, 8)}...</span>
                      <span>{inq.createdAt}</span>
                    </div>
                    <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{inq.title}</h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>{inq.content}</p>
                    
                    {inq.status === 'PENDING' ? (
                      <div>
                        <textarea 
                          className="form-input" 
                          placeholder="Write support reply..." 
                          value={newAdminAnswer} 
                          onChange={(e) => setNewAdminAnswer(e.target.value)}
                          style={{ marginBottom: '0.5rem' }}
                        ></textarea>
                        <button className="btn btn-primary" onClick={() => handleAnswerInquiry(inq.id)}>
                          Answer Ticket
                        </button>
                      </div>
                    ) : (
                      <div style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderLeft: '2px solid var(--success)', borderRadius: '0.25rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)' }}>Admin Reply:</div>
                        <p style={{ fontSize: '0.9rem' }}>{inq.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
                {inquiries.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No support inquiries found.</div>
                )}
              </div>
            ) : (
              // User inquiry list view
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {inquiries.filter(i => i.userId === currentUser.id).map(inq => (
                  <div key={inq.id} style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      <span>Status: <span className={inq.status === 'ANSWERED' ? 'badge badge-success' : 'badge badge-pending'}>{inq.status}</span></span>
                      <span>{inq.createdAt}</span>
                    </div>
                    <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{inq.title}</h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{inq.content}</p>
                    
                    {inq.answer && (
                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderLeft: '2px solid var(--success)', borderRadius: '0.25rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', marginBottom: '0.25rem' }}>Answer:</div>
                        <p style={{ fontSize: '0.9rem' }}>{inq.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
                {inquiries.filter(i => i.userId === currentUser.id).length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No inquiries submitted yet.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
