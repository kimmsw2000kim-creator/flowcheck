import {
  useId,
  type FormEvent,
} from 'react';

import { MessageCircle } from 'lucide-react';

import { COMMUNITY_LIMITS } from '../../constants/communityLimits';
import type { ForumComment } from '../../types/community';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
} from '../common';

export interface ForumCommentThreadProps {
  comments: ForumComment[];

  /**
   * 페이징으로 잘린 배열 길이가 아니라
   * 게시글의 전체 댓글 개수를 전달합니다.
   */
  commentCount?: number;

  currentUserEmail: string;
  value: string;
  replyValue: string;
  replyParentId: number | null;
  label?: string;

  onValueChange: (value: string) => void;
  onReplyValueChange: (value: string) => void;

  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;

  onSubmitReply: (
    event: FormEvent<HTMLFormElement>,
    parentId: number,
  ) => void;

  onToggleReply: (
    commentId: number | null,
  ) => void;

  onDelete: (
    commentId: number,
    isReply?: boolean,
  ) => void;

  onReport?: (commentId: number) => void;
}

function normalizeEmail(
  email?: string | null,
) {
  return email?.trim().toLowerCase() ?? '';
}

function getWriter(
  comment: ForumComment,
) {
  return (
    comment.writerEmail ||
    comment.author ||
    'unknown'
  );
}

function CommentAuthor({ comment, reply = false }: { comment: ForumComment; reply?: boolean }) {
  const writer = getWriter(comment);
  // 기본 아바타 처리
  const initial = writer.charAt(0).toUpperCase() || 'F';

  return (
    <span className="community-author">
      <span className="community-author__avatar community-author__avatar--sm" aria-hidden="true">
        {initial}
        {comment.writerAvatarUrl && <img src={comment.writerAvatarUrl} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />}
      </span>
      <strong className="community-author__name">{reply ? '↳ ' : ''}{writer}</strong>
    </span>
  );
}

export default function ForumCommentThread({
  comments,
  commentCount = comments.reduce(
    (count, comment) => count + 1 + (comment.replies?.length ?? 0),
    0,
  ),
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

  const roots = comments.filter(
    (comment) => comment.parentId == null,
  );

  const normalizedCurrentUserEmail =
    normalizeEmail(currentUserEmail);

  const isOwner = (
    comment: ForumComment,
  ) => {
    const writerEmail = normalizeEmail(
      comment.writerEmail ??
      comment.author,
    );

    return Boolean(
      normalizedCurrentUserEmail &&
      writerEmail &&
      normalizedCurrentUserEmail === writerEmail,
    );
  };

  return (
    <Card
      as="section"
      padding="lg"
      className="community-comments"
      aria-labelledby={`comments-${uid}`}
    >
      <div className="community-comments__header">
        <h2
          id={`comments-${uid}`}
          className="community-comments__title"
        >
          {label}
        </h2>

        <Badge tone="neutral">
          {commentCount}개
        </Badge>
      </div>

      <form
        onSubmit={onSubmit}
        className="community-comment-form"
      >
        <Field
          label={`${label} 작성`}
          htmlFor={`comment-${uid}`}
          description={`${value.length} / ${COMMUNITY_LIMITS.COMMENT}자`}
          required
        >
          <textarea
            id={`comment-${uid}`}
            className="fc-input"
            rows={4}
            value={value}
            onChange={(event) =>
              onValueChange(
                event.target.value,
              )
            }
            required
          />
        </Field>

        <Button type="submit">
          등록
        </Button>
      </form>

      {roots.length === 0 ? (
        <EmptyState
          icon={
            <MessageCircle
              aria-hidden="true"
            />
          }
          title={`아직 ${label}이 없습니다.`}
          description="첫 번째 의견을 남겨보세요."
        />
      ) : (
        <div className="community-comment-list">
          {roots.map((comment) => {
            const replyId =
              `reply-${uid}-${comment.id}`;

            const expanded =
              replyParentId === comment.id;

            return (
              <div key={comment.id}>
                <article className="community-comment">
                  <CommentAuthor comment={comment} />

                  <p>{comment.content}</p>

                  <div className="community-comment__footer">
                    <time
                      dateTime={comment.createdAt}
                    >
                      {comment.createdAt
                        ?.replace('T', ' ')
                        .slice(0, 16)}
                    </time>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-expanded={expanded}
                      aria-controls={replyId}
                      onClick={() =>
                        onToggleReply(
                          expanded
                            ? null
                            : comment.id,
                        )
                      }
                    >
                      답글
                    </Button>

                    {isOwner(comment) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          onDelete(
                            comment.id,
                            false,
                          )
                        }
                      >
                        삭제
                      </Button>
                    )}

                    {onReport && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          onReport(comment.id)
                        }
                      >
                        신고
                      </Button>
                    )}
                  </div>
                </article>

                {expanded && (
                  <form
                    id={replyId}
                    className="community-reply-form"
                    onSubmit={(event) =>
                      onSubmitReply(
                        event,
                        comment.id,
                      )
                    }
                  >
                    <Field
                      label={`${getWriter(comment)}님에게 답글`}
                      htmlFor={`${replyId}-input`}
                      description={`${replyValue.length} / ${COMMUNITY_LIMITS.REPLY}자`}
                      required
                    >
                      <textarea
                        id={`${replyId}-input`}
                        className="fc-input"
                        rows={3}
                        value={replyValue}
                        onChange={(event) =>
                          onReplyValueChange(
                            event.target.value,
                          )
                        }
                        required
                        autoFocus
                      />
                    </Field>

                    <div className="community-actions">
                      <Button
                        type="submit"
                        size="sm"
                      >
                        답글 등록
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          onToggleReply(null)
                        }
                      >
                        취소
                      </Button>
                    </div>
                  </form>
                )}

                {(comment.replies ?? []).map(
                  (reply) => (
                    <article
                      key={reply.id}
                      className={
                        'community-comment ' +
                        'community-comment--reply'
                      }
                    >
                      <CommentAuthor comment={reply} reply />

                      <p>{reply.content}</p>

                      <div className="community-comment__footer">
                        <time
                          dateTime={reply.createdAt}
                        >
                          {reply.createdAt
                            ?.replace('T', ' ')
                            .slice(0, 16)}
                        </time>

                        {isOwner(reply) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              onDelete(
                                reply.id,
                                true,
                              )
                            }
                          >
                            삭제
                          </Button>
                        )}

                        {onReport && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              onReport(reply.id)
                            }
                          >
                            신고
                          </Button>
                        )}
                      </div>
                    </article>
                  ),
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
