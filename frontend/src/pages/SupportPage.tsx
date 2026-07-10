import React, { useState } from 'react';
import { useUserStore } from '../store/userStore';
import { useAlertStore } from '../store/alertStore';

interface Inquiry {
  id: number;
  userId: string;
  title: string;
  content: string;
  status: string;
  answer: string | null;
  createdAt: string;
}

export default function SupportPage() {
  const currentUser = useUserStore((state) => state.currentUser);
  const showAlert = useAlertStore((state) => state.showAlert);

  const [inquiries, setInquiries] = useState<Inquiry[]>([
    { id: 1, userId: 'f87a32d1-921c-4b9b-90f3-cb2071850123', title: 'Payment Webhook Delay', content: 'I deposited 50,000 KRW to the virtual account, but it took 10 minutes to update.', status: 'PENDING', answer: null, createdAt: '2026-06-30' }
  ]);
  const [newInquiryTitle, setNewInquiryTitle] = useState<string>('');
  const [newInquiryContent, setNewInquiryContent] = useState<string>('');

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

  const myInquiries = inquiries.filter(i => i.userId === currentUser.id);

  return (
    <div style={{ textAlign: 'left' }}>
      <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>고객 지원</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
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

        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>내 문의 내역</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {myInquiries.map(inq => (
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
            {myInquiries.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>작성하신 고객 문의 내역이 없습니다.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
