import { useEffect, useId, useState } from 'react';
import { answerInquiry, fetchAdminInquiries } from '../../api/inquiryApi';
import { Badge, Button, Card, EmptyState, Field } from '../../components/common';
import { useAlertStore } from '../../store/alertStore';
import type { Inquiry } from '../../types/inquiry';

function formatDate(value: string): string {
  return new Date(value).toLocaleString('ko-KR');
}

export default function InquiryManagementTab() {
  const idPrefix = useId().replace(/:/g, '');
  const showAlert = useAlertStore((state) => state.showAlert);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});
  const [answeringId, setAnsweringId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadInquiries = async () => {
      try {
        const data = await fetchAdminInquiries();
        if (!cancelled) setInquiries(data);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : '고객 문의를 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadInquiries();
    return () => { cancelled = true; };
  }, []);

  const handleAnswerInquiry = async (id: number) => {
    const answer = answerDrafts[id]?.trim();
    if (!answer || answeringId !== null) return;

    try {
      setAnsweringId(id);
      const updated = await answerInquiry(id, answer);
      // 답변 완료 상태 즉시 반영
      setInquiries((current) => current.map((inquiry) => inquiry.id === id ? updated : inquiry));
      setAnswerDrafts((current) => ({ ...current, [id]: '' }));
      showAlert('문의 답변이 등록되었습니다.', 'success');
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '답변 등록에 실패했습니다.', 'error');
    } finally {
      setAnsweringId(null);
    }
  };

  return (
    <Card as="section">
      <h2 className="utility-card-title">1:1 고객 문의 내역 및 답변</h2>
      <p className="utility-card-description">접수된 문의를 확인하고 사용자에게 답변할 수 있습니다.</p>
      {loading ? (
        <EmptyState title="고객 문의를 불러오는 중입니다." description="잠시만 기다려 주세요." />
      ) : errorMessage ? (
        <EmptyState title={errorMessage} description="관리자 권한과 서버 상태를 확인해 주세요." />
      ) : inquiries.length === 0 ? (
        <EmptyState title="접수된 고객 문의가 없습니다." description="새 문의가 등록되면 이곳에 표시됩니다." />
      ) : (
        <div className="utility-stack">
          {inquiries.map((inquiry) => {
            const answerId = `${idPrefix}-answer-${inquiry.id}`;
            return (
              <Card as="article" variant="subtle" padding="sm" className="inquiry-item" key={inquiry.id}>
                <div className="inquiry-meta"><span>작성자: {inquiry.userEmail}</span><time dateTime={inquiry.createdAt}>{formatDate(inquiry.createdAt)}</time></div>
                <div><Badge tone={inquiry.status === 'ANSWERED' ? 'success' : 'warning'}>{inquiry.status === 'ANSWERED' ? '답변 완료' : '답변 대기'}</Badge></div>
                <h3 className="inquiry-title">{inquiry.title}</h3>
                <p className="inquiry-content">{inquiry.content}</p>
                {inquiry.status === 'PENDING' ? (
                  <>
                    <Field label="관리자 답변" htmlFor={answerId}>
                      <textarea id={answerId} className="fc-input utility-textarea" rows={4} placeholder="답변 내용을 작성하세요" value={answerDrafts[inquiry.id] ?? ''} onChange={(event) => setAnswerDrafts((current) => ({ ...current, [inquiry.id]: event.target.value }))} maxLength={5000} />
                    </Field>
                    <div><Button type="button" disabled={!answerDrafts[inquiry.id]?.trim() || answeringId !== null} onClick={() => { void handleAnswerInquiry(inquiry.id); }}>{answeringId === inquiry.id ? '등록 중...' : '답변 등록'}</Button></div>
                  </>
                ) : (
                  <div className="inquiry-answer"><strong>관리자 답변</strong><p>{inquiry.answer}</p></div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Card>
  );
}
