import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import {
  answerInquiry,
  deleteAdminInquiry,
  fetchAdminInquiries,
} from '../../api/inquiryApi';
import { Badge, Button, Card, EmptyState, Field, Select, TextField } from '../../components/common';
import { useAlertStore } from '../../store/alertStore';
import type { InquiryPage, InquiryStatus } from '../../types/inquiry';

function formatDate(value: string): string {
  return new Date(value).toLocaleString('ko-KR');
}

export default function InquiryManagementTab() {
  const idPrefix = useId().replace(/:/g, '');
  const showAlert = useAlertStore((state) => state.showAlert);
  const [inquiryPage, setInquiryPage] = useState<InquiryPage | null>(null);
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});
  const [answeringId, setAnsweringId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<InquiryStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const inquiries = inquiryPage?.content ?? [];
  const totalPages = inquiryPage?.totalPages ?? 0;

  useEffect(() => {
    let cancelled = false;

    const loadInquiries = async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        const data = await fetchAdminInquiries(page, keyword, status);
        if (!cancelled) setInquiryPage(data);
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
  }, [keyword, page, refreshKey, status]);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(0);
    setKeyword(searchInput.trim());
  };

  const handleAnswerInquiry = async (id: number) => {
    const currentInquiry = inquiries.find((inquiry) => inquiry.id === id);
    const answer = (answerDrafts[id] ?? currentInquiry?.answer ?? '').trim();
    if (!answer || answeringId !== null) return;

    try {
      setAnsweringId(id);
      const updated = await answerInquiry(id, answer);
      // 신규 답변과 답변 수정을 현재 페이지에 반영합니다.
      setInquiryPage((current) => current ? {
        ...current,
        content: current.content.map((inquiry) => inquiry.id === id ? updated : inquiry),
      } : current);
      setAnswerDrafts((current) => ({ ...current, [id]: updated.answer ?? '' }));
      showAlert(currentInquiry?.status === 'ANSWERED' ? '문의 답변이 수정되었습니다.' : '문의 답변이 등록되었습니다.', 'success');
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '답변 저장에 실패했습니다.', 'error');
    } finally {
      setAnsweringId(null);
    }
  };

  const handleDeleteInquiry = async (id: number) => {
    if (!window.confirm('이 문의를 관리자 권한으로 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.')) return;

    try {
      setDeletingId(id);
      await deleteAdminInquiry(id);
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
    <Card as="section">
      <h2 className="utility-card-title">1:1 고객 문의 내역 및 답변</h2>
      <p className="utility-card-description">접수된 문의를 검색하고 사용자에게 답변할 수 있습니다.</p>
      <form className="inquiry-toolbar inquiry-toolbar--admin" role="search" onSubmit={handleSearch}>
        <TextField label="문의 검색" placeholder="제목, 내용 또는 이메일" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={100} />
        <Select label="답변 상태" value={status} onChange={(event) => { setPage(0); setStatus(event.target.value as InquiryStatus | 'ALL'); }}>
          <option value="ALL">전체</option>
          <option value="PENDING">답변 대기</option>
          <option value="ANSWERED">답변 완료</option>
        </Select>
        <Button type="submit" variant="secondary">검색</Button>
      </form>
      {loading ? (
        <EmptyState title="고객 문의를 불러오는 중입니다." description="잠시만 기다려 주세요." />
      ) : errorMessage ? (
        <EmptyState title={errorMessage} description="관리자 권한과 서버 상태를 확인해 주세요." />
      ) : inquiries.length === 0 ? (
        <EmptyState title={keyword || status !== 'ALL' ? '검색 결과가 없습니다.' : '접수된 고객 문의가 없습니다.'} description={keyword || status !== 'ALL' ? '검색어 또는 상태 조건을 변경해 보세요.' : '새 문의가 등록되면 이곳에 표시됩니다.'} />
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
                <Field label={inquiry.status === 'ANSWERED' ? '관리자 답변 수정' : '관리자 답변'} htmlFor={answerId}>
                  <textarea id={answerId} className="fc-input utility-textarea" rows={4} placeholder="답변 내용을 작성하세요" value={answerDrafts[inquiry.id] ?? inquiry.answer ?? ''} onChange={(event) => setAnswerDrafts((current) => ({ ...current, [inquiry.id]: event.target.value }))} maxLength={5000} />
                </Field>
                <div className="inquiry-actions">
                  <Button type="button" size="sm" isLoading={answeringId === inquiry.id} loadingText="저장 중..." disabled={!(answerDrafts[inquiry.id] ?? inquiry.answer ?? '').trim() || answeringId !== null || deletingId !== null} onClick={() => { void handleAnswerInquiry(inquiry.id); }}>{inquiry.status === 'ANSWERED' ? '답변 수정' : '답변 등록'}</Button>
                  <Button type="button" size="sm" variant="danger" isLoading={deletingId === inquiry.id} loadingText="삭제 중..." disabled={answeringId !== null || deletingId !== null} onClick={() => { void handleDeleteInquiry(inquiry.id); }}>문의 삭제</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {totalPages > 1 && (
        <div className="inquiry-pagination" aria-label="관리자 문의 페이지 이동">
          <Button type="button" variant="secondary" size="sm" disabled={page === 0 || loading} onClick={() => setPage((current) => Math.max(0, current - 1))}>이전</Button>
          <span>{page + 1} / {totalPages}</span>
          <Button type="button" variant="secondary" size="sm" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>다음</Button>
        </div>
      )}
    </Card>
  );
}
