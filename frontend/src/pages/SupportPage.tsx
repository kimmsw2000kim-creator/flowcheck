import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Badge, Button, Card, EmptyState, Field, PageHeader, TextField } from '../components/common';
import { useAlertStore } from '../store/alertStore';
import { useUserStore } from '../store/userStore';

interface Inquiry {
  id: number;
  userId: string;
  title: string;
  content: string;
  status: 'PENDING' | 'ANSWERED';
  answer: string | null;
  createdAt: string;
}

export default function SupportPage() {
  const currentUser = useUserStore((state) => state.currentUser);
  const showAlert = useAlertStore((state) => state.showAlert);
  const contentId = useId().replace(/:/g, '');
  const [inquiries, setInquiries] = useState<Inquiry[]>([
    { id: 1, userId: 'f87a32d1-921c-4b9b-90f3-cb2071850123', title: '결제 반영 지연', content: '가상계좌 입금 후 잔액 반영까지 시간이 오래 걸렸습니다.', status: 'PENDING', answer: null, createdAt: '2026-06-30' },
  ]);
  const [newInquiryTitle, setNewInquiryTitle] = useState('');
  const [newInquiryContent, setNewInquiryContent] = useState('');

  const handleCreateInquiry = (event: FormEvent) => {
    event.preventDefault();
    if (!newInquiryTitle.trim() || !newInquiryContent.trim()) return;
    setInquiries((current) => [...current, {
      id: Math.max(0, ...current.map((inquiry) => inquiry.id)) + 1,
      userId: currentUser.id,
      title: newInquiryTitle.trim(),
      content: newInquiryContent.trim(),
      status: 'PENDING',
      answer: null,
      createdAt: new Date().toISOString().split('T')[0],
    }]);
    setNewInquiryTitle('');
    setNewInquiryContent('');
    showAlert('고객 문의가 등록되었습니다.', 'success');
  };

  const myInquiries = inquiries.filter((inquiry) => inquiry.userId === currentUser.id);

  return (
    <section className="utility-page">
      <PageHeader className="utility-page__header" headingLevel={1} eyebrow="SUPPORT" title="고객 지원" description="결제, 테스트, 쿠폰 이용 중 궁금한 점을 남겨 주세요." />
      <div className="utility-grid">
        <Card as="section">
          <h2 className="utility-card-title">1:1 문의 제출</h2>
          <p className="utility-card-description">문의 내역은 현재 브라우저 세션에서만 유지됩니다.</p>
          <form onSubmit={handleCreateInquiry}>
            <TextField label="제목" placeholder="문의 제목을 입력하세요" value={newInquiryTitle} onChange={(event) => setNewInquiryTitle(event.target.value)} required />
            <Field label="문의 내용" htmlFor={contentId} required>
              <textarea id={contentId} className="fc-input utility-textarea" rows={6} placeholder="문의할 내용을 자세히 입력해 주세요" value={newInquiryContent} onChange={(event) => setNewInquiryContent(event.target.value)} required />
            </Field>
            <Button type="submit">문의하기</Button>
          </form>
        </Card>
        <Card as="section">
          <h2 className="utility-card-title">내 문의 내역</h2>
          {myInquiries.length === 0 ? (
            <EmptyState title="작성한 문의가 없습니다." description="새 문의를 등록하면 이곳에 표시됩니다." />
          ) : (
            <div className="utility-stack">
              {myInquiries.map((inquiry) => (
                <Card as="article" variant="subtle" padding="sm" className="inquiry-item" key={inquiry.id}>
                  <div className="inquiry-meta"><Badge tone={inquiry.status === 'ANSWERED' ? 'success' : 'warning'}>{inquiry.status === 'ANSWERED' ? '답변 완료' : '답변 대기'}</Badge><time>{inquiry.createdAt}</time></div>
                  <h3 className="inquiry-title">{inquiry.title}</h3>
                  <p className="inquiry-content">{inquiry.content}</p>
                  {inquiry.answer && <div className="inquiry-answer"><strong>답변</strong><p>{inquiry.answer}</p></div>}
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
