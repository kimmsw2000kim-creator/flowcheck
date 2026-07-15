import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createCommunityPost } from '../../api/communityPostApi';
import { useAlertStore } from '../../store/alertStore';
import type { MypageTestHistoryItem } from '../../types/mypage';
import { Button, Card, Field, PageHeader } from '../common';
import CommunityTestPicker from './CommunityTestPicker';
import TestSharePostList from './TestSharePostList';

export default function TestHistoryTab() {
  const showAlert = useAlertStore((state) => state.showAlert);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedTest, setSelectedTest] = useState<MypageTestHistoryItem | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (selectedTest && dialog && !dialog.open) dialog.showModal();
    if (!selectedTest && dialog?.open) dialog.close();
  }, [selectedTest]);

  const close = () => {
    if (submitting) return;
    dialogRef.current?.close();
    setSelectedTest(null);
    setTitle('');
    setContent('');
  };

  const selectTest = (test: MypageTestHistoryItem) => {
    setSelectedTest(test);
    setTitle(`${test.testName} 테스트 결과 공유`);
    setContent('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTest || !title.trim() || !content.trim()) return;
    try {
      setSubmitting(true);
      await createCommunityPost({ category: 'TEST_SHARE', title: title.trim(), content: content.trim(), testRequestId: selectedTest.requestId });
      showAlert('테스트 결과가 커뮤니티에 공유되었습니다.', 'success');
      setRefreshKey((value) => value + 1);
      dialogRef.current?.close();
      setSelectedTest(null);
      setTitle('');
      setContent('');
    } catch (submitError) {
      showAlert(submitError instanceof Error ? submitError.message : '테스트 결과를 공유하지 못했습니다.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="community-tab-panel__content">
      <PageHeader headingLevel={2} title="완료된 테스트 공유" description="내 테스트 이력에서 결과를 선택해 다른 사용자와 공유할 수 있습니다." />
      <CommunityTestPicker onSelect={selectTest} />
      <TestSharePostList refreshKey={refreshKey} />

      <dialog
        ref={dialogRef}
        className="community-dialog"
        aria-labelledby="test-share-dialog-title"
        onCancel={(event) => { if (submitting) event.preventDefault(); else close(); }}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      >
        <Card as="section" padding="lg" className="community-dialog__content">
          <h2 id="test-share-dialog-title">테스트 결과 공유</h2>
          {selectedTest && (
            <>
              <Card variant="subtle" padding="sm" className="community-dialog__summary">
                <strong>{selectedTest.testName}</strong><p>{selectedTest.targetUrl}</p>
              </Card>
              <form onSubmit={submit} aria-busy={submitting || undefined}>
                <Field label="공유글 제목" htmlFor="test-share-title" required>
                  <input id="test-share-title" className="fc-input form-input" maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} disabled={submitting} autoFocus required />
                </Field>
                <Field label="테스트 결과 소개" htmlFor="test-share-content" required>
                  <textarea id="test-share-content" className="fc-input form-input" rows={6} value={content} onChange={(event) => setContent(event.target.value)} disabled={submitting} required />
                </Field>
                <div className="community-actions">
                  <Button type="submit" isLoading={submitting} loadingText="공유 중...">테스트 결과 공유</Button>
                  <Button type="button" variant="secondary" disabled={submitting} onClick={close}>취소</Button>
                </div>
              </form>
            </>
          )}
        </Card>
      </dialog>
    </div>
  );
}
