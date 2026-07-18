import {
  AlertCircle,
  ExternalLink,
  Pencil,
  Share2,
  ThumbsUp,
  Trash2,
} from 'lucide-react';

import type { ForumPost } from '../../types/community';

import {
  Badge,
  Button,
  Card,
} from '../common';

import {
  getForumLikeCount,
  getForumWriter,
} from './forumUtils';

export interface ForumPostDetailProps {
  post: ForumPost;
  liked: boolean;

  /**
   * 기존 사용처와의 호환성을 위해 유지합니다.
   * 댓글 개수는 이제 ForumCommentThread에서 표시합니다.
   */
  feedbackLabel?: string;

  onLike: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
  onShare?: () => void;
}

function PostAuthor({ post }: { post: ForumPost }) {
  const writer = getForumWriter(post);
  // 기본 아바타 처리
  const initial = writer.charAt(0).toUpperCase() || 'F';

  return (
    <span className="community-author">
      <span className="community-author__avatar" aria-hidden="true">
        {initial}
        {post.writerAvatarUrl && <img src={post.writerAvatarUrl} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />}
      </span>
      <span className="community-author__name">{writer}</span>
    </span>
  );
}

export default function ForumPostDetail({
  post,
  liked,
  onLike,
  onEdit,
  onDelete,
  onReport,
  onShare,
}: ForumPostDetailProps) {
  return (
    <Card
      as="article"
      padding="lg"
      className="community-detail"
    >
      <div className="community-post-meta">
        <PostAuthor post={post} />

        <time dateTime={post.createdAt}>
          {post.createdAt
            ?.replace('T', ' ')
            .slice(0, 16)}
        </time>
      </div>

      <h2>{post.title}</h2>

      <p className="community-detail__content">
        {post.content}
      </p>

      {post.promoUrl && (
        <div className="community-promo-link">
          <div>
            <Badge tone="info">
              프로모션 링크
            </Badge>

            <a
              href={post.promoUrl}
              target="_blank"
              rel="noreferrer"
            >
              {post.promoUrl}

              <ExternalLink
                size={14}
                aria-hidden="true"
              />
            </a>
          </div>

          {onShare && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={Share2}
              onClick={onShare}
            >
              공유
            </Button>
          )}
        </div>
      )}

      <div className="community-detail__footer">
        <div className="community-actions">
          <Button
            type="button"
            variant={
              liked
                ? 'primary'
                : 'secondary'
            }
            size="sm"
            icon={ThumbsUp}
            aria-pressed={liked}
            onClick={onLike}
          >
            좋아요 {getForumLikeCount(post)}
          </Button>

          {onReport && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={AlertCircle}
              onClick={onReport}
            >
              신고
            </Button>
          )}
        </div>

        {(onEdit || onDelete) && (
          <div className="community-actions">
            {onEdit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={Pencil}
                onClick={onEdit}
              >
                수정
              </Button>
            )}

            {onDelete && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={onDelete}
              >
                삭제
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
