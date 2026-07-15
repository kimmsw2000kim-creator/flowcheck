import { useState, type FormEvent } from 'react';
import { createCommunityPost } from '../../api/communityPostApi';
import { useDomains } from '../../hooks/useDomains';
import { useAlertStore } from '../../store/alertStore';
import { Badge, Button, Card, EmptyState, Field, PageHeader } from '../common';
import SitePromotionPostList from './SitePromotionPostList';

export default function SitePromotionTab() {
  const { domains } = useDomains();
  const showAlert = useAlertStore((state) => state.showAlert);
  const [selectedDomainId, setSelectedDomainId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const verifiedDomains = domains.filter((domain) => domain.verified);
  const selectedDomain = verifiedDomains.find((domain) => domain.id === selectedDomainId);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDomainId || !title.trim() || !content.trim()) return;
    try {
      setSubmitting(true);
      await createCommunityPost({ category: 'SITE_PROMOTION', title: title.trim(), content: content.trim(), siteId: selectedDomainId });
      showAlert('사이트 홍보 게시글이 등록되었습니다.', 'success');
      setSelectedDomainId(null);
      setTitle('');
      setContent('');
      setRefreshKey((value) => value + 1);
    } catch (submitError) {
      showAlert(submitError instanceof Error ? submitError.message : '사이트 홍보 게시글을 등록하지 못했습니다.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="community-tab-panel__content">
      <PageHeader headingLevel={2} title="내 사이트 홍보" description="소유권 인증이 완료된 사이트를 선택해 소개해 보세요." />
      {verifiedDomains.length === 0 ? (
        <EmptyState title="홍보할 수 있는 사이트가 없습니다." description="사이트를 등록하고 소유권 인증을 완료해 주세요." />
      ) : (
        <Card as="section" padding="lg">
          <fieldset className="community-site-picker">
            <legend>홍보할 사이트 선택</legend>
            <div className="community-site-picker__grid" role="radiogroup">
              {verifiedDomains.map((domain) => (
                <label key={domain.id} className="community-site-option">
                  <input type="radio" name="promotion-site" value={domain.id} checked={selectedDomainId === domain.id} onChange={() => setSelectedDomainId(domain.id)} />
                  <span className="community-site-option__content">
                    <strong>{domain.serviceName || domain.domainUrl}</strong>
                    <small>{domain.domainUrl}</small>
                    <Badge tone="success">인증 완료</Badge>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {selectedDomain && (
            <form className="community-promotion-form" onSubmit={submit} aria-busy={submitting || undefined}>
              <h3>{selectedDomain.serviceName || selectedDomain.domainUrl} 소개 작성</h3>
              <Field label="홍보글 제목" htmlFor="promotion-title" required>
                <input id="promotion-title" className="fc-input" maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} disabled={submitting} required />
              </Field>
              <Field label="사이트 소개" htmlFor="promotion-content" required>
                <textarea id="promotion-content" className="fc-input" rows={6} value={content} onChange={(event) => setContent(event.target.value)} disabled={submitting} required />
              </Field>
              <Button type="submit" isLoading={submitting} loadingText="등록 중...">사이트 홍보글 등록</Button>
            </form>
          )}
        </Card>
      )}
      <SitePromotionPostList refreshKey={refreshKey} />
    </div>
  );
}
