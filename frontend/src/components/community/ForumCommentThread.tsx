import { useId, type FormEvent } from 'react';
import { MessageCircle } from 'lucide-react';
import type { ForumComment } from '../../types/community';
import { Button, Card, EmptyState, Field } from '../common';

export interface ForumCommentThreadProps {
  comments: ForumComment[];
  currentUserEmail: string;
  value: string;
  replyValue: string;
  replyParentId: number | null;
  label?: string;
  onValueChange: (value: string) => void;
  onReplyValueChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitReply: (event: FormEvent<HTMLFormElement>, parentId: number) => void;
  onToggleReply: (commentId: number | null) => void;
  onDelete: (commentId: number, isReply?: boolean) => void;
  onReport?: (commentId: number) => void;
}

function writer(comment: ForumComment) {
  return comment.writerEmail || comment.author || 'unknown';
}

export default function ForumCommentThread({
  comments,
  currentUserEmail,
  value,
  replyValue,
  replyParentId,
  label = '댓글',
  onValueChange,
  onReplyValueChange,
  onSubmit,
  onSubmitReply,
  onToggleReply,
  onDelete,
  onReport,
}: ForumCommentThreadProps) {
  const uid = useId().replace(/:/g, '');
  const roots = comments.filter((comment) => comment.parentId === null);
  const isOwner = (comment: ForumComment) => writer(comment).toLowerCase() === currentUserEmail.toLowerCase();

  return (
    <Card as="section" padding="lg" className="community-comments" aria-labelledby={`comments-${uid}`}>
      <h2 id={`comments-${uid}`}>{label}</h2>
      <form onSubmit={onSubmit} className="community-comment-form">
        <Field label={`${label} 작성`} htmlFor={`comment-${uid}`} required>
          <textarea id={`comment-${uid}`} className="fc-input" rows={4} value={value} onChange={(event) => onValueChange(event.target.value)} required />
        </Field>
        <Button type="submit">등록</Button>
      </form>

      {roots.length === 0 ? (
        <EmptyState icon={<MessageCircle aria-hidden="true" />} title={`아직 ${label}이 없습니다.`} description="첫 번째 의견을 남겨보세요." />
      ) : (
        <div className="community-comment-list">
          {roots.map((comment) => {
            const replyId = `reply-${uid}-${comment.id}`;
            const expanded = replyParentId === comment.id;
            return (
              <div key={comment.id}>
                <article className="community-comment">
                  <strong>{writer(comment)}</strong>
                  <p>{comment.content}</p>
                  <div className="community-comment__footer">
                    <time dateTime={comment.createdAt}>{comment.createdAt?.replace('T', ' ').slice(0, 16)}</time>
                    <Button variant="ghost" size="sm" aria-expanded={expanded} aria-controls={replyId} onClick={() => onToggleReply(expanded ? null : comment.id)}>답글</Button>
                    {isOwner(comment) && <Button variant="ghost" size="sm" onClick={() => onDelete(comment.id)}>삭제</Button>}
                    {onReport && <Button variant="ghost" size="sm" onClick={() => onReport(comment.id)}>신고</Button>}
                  </div>
                </article>

                {expanded && (
                  <form id={replyId} className="community-reply-form" onSubmit={(event) => onSubmitReply(event, comment.id)}>
                    <Field label={`${writer(comment)}님에게 답글`} htmlFor={`${replyId}-input`} required>
                      <textarea id={`${replyId}-input`} className="fc-input" rows={3} value={replyValue} onChange={(event) => onReplyValueChange(event.target.value)} required autoFocus />
                    </Field>
                    <div className="community-actions">
                      <Button type="submit" size="sm">답글 등록</Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => onToggleReply(null)}>취소</Button>
                    </div>
                  </form>
                )}

                {(comment.replies || []).map((reply) => (
                  <article key={reply.id} className="community-comment community-comment--reply">
                    <strong>↳ {writer(reply)}</strong>
                    <p>{reply.content}</p>
                    <div className="community-comment__footer">
                      <time dateTime={reply.createdAt}>{reply.createdAt?.replace('T', ' ').slice(0, 16)}</time>
                      {isOwner(reply) && <Button variant="ghost" size="sm" onClick={() => onDelete(reply.id, true)}>삭제</Button>}
                      {onReport && <Button variant="ghost" size="sm" onClick={() => onReport(reply.id)}>신고</Button>}
                    </div>
                  </article>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
