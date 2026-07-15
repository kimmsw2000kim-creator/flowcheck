import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button, Card, Field } from '../common';

export interface PostEditorFormProps {
  mode: 'create' | 'edit';
  initialTitle?: string;
  initialContent?: string;
  initialPromoUrl?: string;
  showPromoUrl?: boolean;
  submitting?: boolean;
  onSubmit: (value: { title: string; content: string; promoUrl?: string }) => void | Promise<void>;
  onCancel: () => void;
}

export default function PostEditorForm({
  mode,
  initialTitle = '',
  initialContent = '',
  initialPromoUrl = '',
  showPromoUrl = false,
  submitting = false,
  onSubmit,
  onCancel,
}: PostEditorFormProps) {
  const uid = useId().replace(/:/g, '');
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [promoUrl, setPromoUrl] = useState(initialPromoUrl);

  useEffect(() => {
    setTitle(initialTitle);
    setContent(initialContent);
    setPromoUrl(initialPromoUrl);
  }, [initialContent, initialPromoUrl, initialTitle]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !title.trim() || !content.trim()) return;
    void onSubmit({
      title: title.trim(),
      content: content.trim(),
      promoUrl: showPromoUrl ? promoUrl.trim() || undefined : undefined,
    });
  };

  return (
    <Card as="section" className="community-editor" padding="lg">
      <form onSubmit={submit} aria-busy={submitting || undefined}>
        <Field
          label="제목"
          htmlFor={`post-title-${uid}`}
          description={`${title.length} / 100자`}
          required
        >
          <input
            id={`post-title-${uid}`}
            className="fc-input form-input"
            value={title}
            maxLength={100}
            onChange={(event) => setTitle(event.target.value)}
            disabled={submitting}
            autoFocus
            required
          />
        </Field>

        {showPromoUrl && (
          <Field label="서비스 주소" htmlFor={`post-url-${uid}`} description="선택 입력 항목입니다.">
            <input
              id={`post-url-${uid}`}
              className="fc-input form-input"
              type="url"
              value={promoUrl}
              placeholder="https://example.com"
              onChange={(event) => setPromoUrl(event.target.value)}
              disabled={submitting}
            />
          </Field>
        )}

        <Field
          label="내용"
          htmlFor={`post-content-${uid}`}
          description={`${content.length} / 5,000자`}
          required
        >
          <textarea
            id={`post-content-${uid}`}
            className="fc-input form-input community-editor__textarea"
            value={content}
            maxLength={5000}
            rows={10}
            onChange={(event) => setContent(event.target.value)}
            disabled={submitting}
            required
          />
        </Field>

        <div className="community-actions">
          <Button type="submit" isLoading={submitting} loadingText={mode === 'create' ? '작성 중...' : '수정 중...'}>
            {mode === 'create' ? '게시글 작성' : '수정 완료'}
          </Button>
          <Button type="button" variant="secondary" disabled={submitting} onClick={onCancel}>
            취소
          </Button>
        </div>
      </form>
    </Card>
  );
}
