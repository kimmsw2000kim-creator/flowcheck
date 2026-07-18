import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { createInquiry, fetchMyInquiries } from '../api/inquiryApi';
import { Badge, Button, Card, EmptyState, Field, PageHeader, TextField } from '../components/common';
import { useAlertStore } from '../store/alertStore';
import type { Inquiry } from '../types/inquiry';

function formatDate(value: string): string {
  return new Date(value).toLocaleString('ko-KR');
}

export default function SupportPage() {
  const showAlert = useAlertStore((state) => state.showAlert);
  const contentId = useId().replace(/:/g, '');
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [newInquiryTitle, setNewInquiryTitle] = useState('');
  const [newInquiryContent, setNewInquiryContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadInquiries = async () => {
      try {
        const data = await fetchMyInquiries();
        if (!cancelled) setInquiries(data);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : '문의 내역을 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadInquiries();
    return () => { cancelled = true; };
  }, []);

  const handleCreateInquiry = async (event: FormEvent) => {
    event.preventDefault();
    const title = newInquiryTitle.trim();
    const content = newInquiryContent.trim();
    if (!title || !content || submitting) return;

    try {
      setSubmitting(true);
      // 등록 결과를 목록 맨 앞에 반영
      const created = await createInquiry({ title, content });
      setInquiries((current) => [created, ...current]);
      setNewInquiryTitle('');
      setNewInquiryContent('');
      showAlert('고객 문의가 등록되었습니다.', 'success');
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '문의 등록에 실패했습니다.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="utility-page">
      <PageHeader className="utility-page__header" headingLevel={1} eyebrow="SUPPORT" title="고객 지원" description="결제, 테스트, 쿠폰 이용 중 궁금한 점을 남겨 주세요." />
      <div className="utility-grid">
        <Card as="section">
          <h2 className="utility-card-title">1:1 문의 제출</h2>
          <p className="utility-card-description">등록한 문의와 관리자 답변은 계정에 안전하게 저장됩니다.</p>
          <form onSubmit={handleCreateInquiry}>
            <TextField label="제목" placeholder="문의 제목을 입력하세요" value={newInquiryTitle} onChange={(event) => setNewInquiryTitle(event.target.value)} maxLength={200} required />
            <Field label="문의 내용" htmlFor={contentId} required>
              <textarea id={contentId} className="fc-input utility-textarea" rows={6} placeholder="문의할 내용을 자세히 입력해 주세요" value={newInquiryContent} onChange={(event) => setNewInquiryContent(event.target.value)} maxLength={5000} required />
            </Field>
            <Button type="submit" disabled={submitting}>{submitting ? '등록 중...' : '문의하기'}</Button>
          </form>
        </Card>
        <Card as="section">
          <h2 className="utility-card-title">내 문의 내역</h2>
          {loading ? (
            <EmptyState title="문의 내역을 불러오는 중입니다." description="잠시만 기다려 주세요." />
          ) : errorMessage ? (
            <EmptyState title={errorMessage} description="잠시 후 다시 시도해 주세요." />
          ) : inquiries.length === 0 ? (
            <EmptyState title="작성한 문의가 없습니다." description="새 문의를 등록하면 이곳에 표시됩니다." />
          ) : (
            <div className="utility-stack">
              {inquiries.map((inquiry) => (
                <Card as="article" variant="subtle" padding="sm" className="inquiry-item" key={inquiry.id}>
                  <div className="inquiry-meta"><Badge tone={inquiry.status === 'ANSWERED' ? 'success' : 'warning'}>{inquiry.status === 'ANSWERED' ? '답변 완료' : '답변 대기'}</Badge><time dateTime={inquiry.createdAt}>{formatDate(inquiry.createdAt)}</time></div>
                  <h3 className="inquiry-title">{inquiry.title}</h3>
                  <p className="inquiry-content">{inquiry.content}</p>
                  {inquiry.answer && <div className="inquiry-answer"><strong>관리자 답변</strong><p>{inquiry.answer}</p></div>}
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
