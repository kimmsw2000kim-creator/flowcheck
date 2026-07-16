import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import { createCommunityPost } from '../../api/communityPostApi';
import { useAlertStore } from '../../store/alertStore';
import type { MypageTestHistoryItem } from '../../types/mypage';
import { Button, Card, Field, PageHeader } from '../common';
import CommunityTestPicker from './CommunityTestPicker';
import TestSharePostList from './TestSharePostList';

export default function TestHistoryTab() {
  const showAlert = useAlertStore((state) => state.showAlert);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [selectedTest, setSelectedTest] =
    useState<MypageTestHistoryItem | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;

    // 테스트가 선택되면 공유 모달을 엽니다.
    if (selectedTest && dialog && !dialog.open) {
      dialog.showModal();
    }

    // 선택이 해제되면 열려 있는 모달을 닫습니다.
    if (!selectedTest && dialog?.open) {
      dialog.close();
    }
  }, [selectedTest]);

  const close = () => {
    // 게시글 저장 중에는 모달이 닫히지 않도록 합니다.
    if (submitting) {
      return;
    }

    dialogRef.current?.close();
    setSelectedTest(null);
    setTitle('');
    setContent('');
  };

  const selectTest = (test: MypageTestHistoryItem) => {
    setSelectedTest(test);

    /*
     * testName에 이미 '테스트'가 포함되어 있으므로
     * '결과 공유'만 붙입니다.
     */
    setTitle(`${test.testName} 결과 공유`);
    setContent('');
  };

  const submit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    /*
     * 테스트 결과 자체만 공유할 수 있으므로
     * 소개글은 검사하지 않습니다.
     */
    if (!selectedTest || !title.trim()) {
      return;
    }

    try {
      setSubmitting(true);

      await createCommunityPost({
        category: 'TEST_SHARE',
        title: title.trim(),
        content: content.trim(),
        testRequestId: selectedTest.requestId,
      });

      showAlert(
        '테스트 결과가 커뮤니티에 공유되었습니다.',
        'success'
      );

      // 게시글 목록을 다시 조회하도록 값을 변경합니다.
      setRefreshKey((value) => value + 1);

      dialogRef.current?.close();
      setSelectedTest(null);
      setTitle('');
      setContent('');
    } catch (submitError: unknown) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : '테스트 결과를 공유하지 못했습니다.';

      showAlert(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="community-tab-panel__content">
      <PageHeader
        headingLevel={2}
        title="완료된 테스트 공유"
        description="내 테스트 이력에서 결과를 선택해 다른 사용자와 공유할 수 있습니다."
      />

      {/* 공유할 완료된 테스트를 선택합니다. */}
      <CommunityTestPicker
        onSelect={selectTest}
        refreshKey={refreshKey}
      />

      {/* 다른 사용자가 공유한 테스트 결과 게시글입니다. */}
      <TestSharePostList refreshKey={refreshKey} />

      <dialog
        ref={dialogRef}
        className="community-dialog"
        aria-labelledby="test-share-dialog-title"
        onCancel={(event) => {
          if (submitting) {
            event.preventDefault();
          } else {
            close();
          }
        }}
        onClick={(event) => {
          // 모달 바깥 영역을 클릭한 경우에만 닫습니다.
          if (event.target === event.currentTarget) {
            close();
          }
        }}
      >
        <Card
          as="section"
          padding="lg"
          className="community-dialog__content"
        >
          <h2 id="test-share-dialog-title">
            테스트 결과 공유
          </h2>

          {selectedTest && (
            <>
              <Card
                variant="subtle"
                padding="sm"
                className="community-dialog__summary"
              >
                <strong>{selectedTest.testName}</strong>
                <p>{selectedTest.targetUrl}</p>
              </Card>

              <form
                onSubmit={submit}
                aria-busy={submitting || undefined}
              >
                <Field
                  label="공유글 제목"
                  htmlFor="test-share-title"
                  required
                >
                  <input
                    id="test-share-title"
                    className="fc-input"
                    maxLength={100}
                    value={title}
                    onChange={(event) =>
                      setTitle(event.target.value)
                    }
                    disabled={submitting}
                    autoFocus
                    required
                  />
                </Field>

                <Field
                  label="테스트 결과 소개 (선택)"
                  htmlFor="test-share-content"
                >
                  <textarea
                    id="test-share-content"
                    className="fc-input"
                    rows={6}
                    value={content}
                    onChange={(event) =>
                      setContent(event.target.value)
                    }
                    disabled={submitting}
                    placeholder="소개 없이 테스트 결과만 공유할 수도 있습니다."
                  />
                </Field>

                <div className="community-actions">
                  <Button
                    type="submit"
                    isLoading={submitting}
                    loadingText="공유 중..."
                  >
                    테스트 결과 공유
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    disabled={submitting}
                    onClick={close}
                  >
                    취소
                  </Button>
                </div>
              </form>
            </>
          )}
        </Card>
      </dialog>
    </div>
  );
}
