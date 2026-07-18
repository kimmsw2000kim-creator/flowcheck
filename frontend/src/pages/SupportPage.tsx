import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import {
  createInquiry,
  deleteMyInquiry,
  fetchMyInquiries,
  updateMyInquiry,
} from '../api/inquiryApi';
import { Badge, Button, Card, EmptyState, Field, PageHeader, TextField } from '../components/common';
import { useAlertStore } from '../store/alertStore';
import type { Inquiry, InquiryPage } from '../types/inquiry';

function formatDate(value: string): string {
  return new Date(value).toLocaleString('ko-KR');
}

export default function SupportPage() {
  const showAlert = useAlertStore((state) => state.showAlert);
  const contentId = useId().replace(/:/g, '');
  const [inquiryPage, setInquiryPage] = useState<InquiryPage | null>(null);
  const [newInquiryTitle, setNewInquiryTitle] = useState('');
  const [newInquiryContent, setNewInquiryContent] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const inquiries = inquiryPage?.content ?? [];
  const totalPages = inquiryPage?.totalPages ?? 0;

  useEffect(() => {
    let cancelled = false;

    const loadInquiries = async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        const data = await fetchMyInquiries(page, keyword);
        if (!cancelled) setInquiryPage(data);
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
  }, [keyword, page, refreshKey]);

  const handleCreateInquiry = async (event: FormEvent) => {
    event.preventDefault();
    const title = newInquiryTitle.trim();
    const content = newInquiryContent.trim();
    if (!title || !content || submitting) return;

    try {
      setSubmitting(true);
      await createInquiry({ title, content });
      setNewInquiryTitle('');
      setNewInquiryContent('');
      setPage(0);
      setRefreshKey((current) => current + 1);
      showAlert('고객 문의가 등록되었습니다.', 'success');
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '문의 등록에 실패했습니다.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = (inquiry: Inquiry) => {
    setEditingId(inquiry.id);
    setEditTitle(inquiry.title);
    setEditContent(inquiry.content);
  };

  const handleUpdateInquiry = async (event: FormEvent, inquiryId: number) => {
    event.preventDefault();
    const title = editTitle.trim();
    const content = editContent.trim();
    if (!title || !content || savingId !== null) return;

    try {
      setSavingId(inquiryId);
      const updated = await updateMyInquiry(inquiryId, { title, content });
      // 수정 결과를 현재 페이지에 즉시 반영합니다.
      setInquiryPage((current) => current ? {
        ...current,
        content: current.content.map((inquiry) => inquiry.id === inquiryId ? updated : inquiry),
      } : current);
      setEditingId(null);
      showAlert('문의가 수정되었습니다.', 'success');
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '문의 수정에 실패했습니다.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteInquiry = async (inquiryId: number) => {
    if (!window.confirm('이 문의를 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.')) return;

    try {
      setDeletingId(inquiryId);
      await deleteMyInquiry(inquiryId);
      if (inquiries.length === 1 && page > 0) {
        setPage((current) => current - 1);
      } else {
        setRefreshKey((current) => current + 1);
      }
      showAlert('문의가 삭제되었습니다.', 'success');
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '문의 삭제에 실패했습니다.', 'error');
    } finally {
      setDeletingId(null);
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
            <Button type="submit" isLoading={submitting} loadingText="등록 중...">문의하기</Button>
          </form>
        </Card>
        <Card as="section">
          <h2 className="utility-card-title">내 문의 내역</h2>
          <form className="inquiry-toolbar" role="search" onSubmit={(event) => { event.preventDefault(); setPage(0); setKeyword(searchInput.trim()); }}>
            <TextField label="문의 검색" placeholder="제목 또는 내용을 검색하세요" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={100} />
            <Button type="submit" variant="secondary">검색</Button>
          </form>
          {loading ? (
            <EmptyState title="문의 내역을 불러오는 중입니다." description="잠시만 기다려 주세요." />
          ) : errorMessage ? (
            <EmptyState title={errorMessage} description="잠시 후 다시 시도해 주세요." />
          ) : inquiries.length === 0 ? (
            <EmptyState title={keyword ? '검색 결과가 없습니다.' : '작성한 문의가 없습니다.'} description={keyword ? '다른 검색어를 입력해 보세요.' : '새 문의를 등록하면 이곳에 표시됩니다.'} />
          ) : (
            <div className="utility-stack">
              {inquiries.map((inquiry) => (
                <Card as="article" variant="subtle" padding="sm" className="inquiry-item" key={inquiry.id}>
                  <div className="inquiry-meta"><Badge tone={inquiry.status === 'ANSWERED' ? 'success' : 'warning'}>{inquiry.status === 'ANSWERED' ? '답변 완료' : '답변 대기'}</Badge><time dateTime={inquiry.createdAt}>{formatDate(inquiry.createdAt)}</time></div>
                  {editingId === inquiry.id ? (
                    <form onSubmit={(event) => { void handleUpdateInquiry(event, inquiry.id); }}>
                      <TextField label="문의 제목" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={200} required />
                      <Field label="문의 내용" htmlFor={`${contentId}-edit-${inquiry.id}`} required>
                        <textarea id={`${contentId}-edit-${inquiry.id}`} className="fc-input utility-textarea" rows={5} value={editContent} onChange={(event) => setEditContent(event.target.value)} maxLength={5000} required />
                      </Field>
                      <div className="inquiry-actions">
                        <Button type="submit" size="sm" isLoading={savingId === inquiry.id} loadingText="저장 중...">저장</Button>
                        <Button type="button" size="sm" variant="ghost" disabled={savingId !== null} onClick={() => setEditingId(null)}>취소</Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <h3 className="inquiry-title">{inquiry.title}</h3>
                      <p className="inquiry-content">{inquiry.content}</p>
                      {inquiry.status === 'PENDING' && (
                        <div className="inquiry-actions">
                          <Button type="button" size="sm" variant="secondary" disabled={deletingId !== null} onClick={() => startEditing(inquiry)}>수정</Button>
                          <Button type="button" size="sm" variant="danger" isLoading={deletingId === inquiry.id} loadingText="삭제 중..." disabled={deletingId !== null} onClick={() => { void handleDeleteInquiry(inquiry.id); }}>삭제</Button>
                        </div>
                      )}
                    </>
                  )}
                  {inquiry.answer && <div className="inquiry-answer"><strong>관리자 답변</strong><p>{inquiry.answer}</p></div>}
                </Card>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <div className="inquiry-pagination" aria-label="문의 페이지 이동">
              <Button type="button" variant="secondary" size="sm" disabled={page === 0 || loading} onClick={() => setPage((current) => Math.max(0, current - 1))}>이전</Button>
              <span>{page + 1} / {totalPages}</span>
              <Button type="button" variant="secondary" size="sm" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>다음</Button>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
