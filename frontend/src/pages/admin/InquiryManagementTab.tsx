import { useId, useState } from 'react';
import { Badge, Button, Card, EmptyState, Field } from '../../components/common';

interface Inquiry { id: number; userId: string; title: string; content: string; status: 'PENDING' | 'ANSWERED'; answer: string | null; createdAt: string; }

export default function InquiryManagementTab() {
  const idPrefix = useId().replace(/:/g, '');
  const [inquiries, setInquiries] = useState<Inquiry[]>([
    { id: 1, userId: 'f87a32d1-921c-4b9b-90f3-cb2071850123', title: '결제 반영 지연', content: '50,000원을 가상계좌로 입금했는데 반영까지 10분이 걸렸습니다.', status: 'PENDING', answer: null, createdAt: '2026-06-30' },
  ]);
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});

  const handleAnswerInquiry = (id: number) => {
    const answer = answerDrafts[id]?.trim();
    if (!answer) return;
    setInquiries((current) => current.map((inquiry) => inquiry.id === id ? { ...inquiry, status: 'ANSWERED', answer } : inquiry));
    setAnswerDrafts((current) => ({ ...current, [id]: '' }));
  };

  return (
    <Card as="section">
      <h2 className="utility-card-title">1:1 고객 문의 내역 및 답변</h2>
      <p className="utility-card-description">문의와 답변은 현재 브라우저 세션에서만 유지됩니다.</p>
      {inquiries.length === 0 ? <EmptyState title="접수된 고객 문의가 없습니다." description="새 문의가 등록되면 이곳에 표시됩니다." /> : <div className="utility-stack">
        {inquiries.map((inquiry) => {
          const answerId = `${idPrefix}-answer-${inquiry.id}`;
          return <Card as="article" variant="subtle" padding="sm" className="inquiry-item" key={inquiry.id}>
            <div className="inquiry-meta"><span>작성 사용자: {inquiry.userId.slice(0, 8)}…</span><time>{inquiry.createdAt}</time></div>
            <div><Badge tone={inquiry.status === 'ANSWERED' ? 'success' : 'warning'}>{inquiry.status === 'ANSWERED' ? '답변 완료' : '답변 대기'}</Badge></div>
            <h3 className="inquiry-title">{inquiry.title}</h3><p className="inquiry-content">{inquiry.content}</p>
            {inquiry.status === 'PENDING' ? <>
              <Field label="관리자 답변" htmlFor={answerId}>
                <textarea id={answerId} className="fc-input utility-textarea" rows={4} placeholder="답변 내용을 작성하세요" value={answerDrafts[inquiry.id] ?? ''} onChange={(event) => setAnswerDrafts((current) => ({ ...current, [inquiry.id]: event.target.value }))} />
              </Field>
              <div><Button type="button" disabled={!answerDrafts[inquiry.id]?.trim()} onClick={() => handleAnswerInquiry(inquiry.id)}>답변 등록</Button></div>
            </> : <div className="inquiry-answer"><strong>관리자 답변</strong><p>{inquiry.answer}</p></div>}
          </Card>;
        })}
      </div>}
    </Card>
  );
}
