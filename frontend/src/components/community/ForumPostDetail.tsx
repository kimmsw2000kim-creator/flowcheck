import { AlertCircle, ExternalLink, Pencil, Share2, ThumbsUp, Trash2 } from 'lucide-react';
import type { ForumPost } from '../../types/community';
import { Badge, Button, Card } from '../common';
import { getForumLikeCount, getForumWriter } from './forumUtils';

export interface ForumPostDetailProps {
  post: ForumPost;
  liked: boolean;
  feedbackLabel?: string;
  onLike: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
  onShare?: () => void;
}

export default function ForumPostDetail({
  post,
  liked,
  feedbackLabel = '댓글',
  onLike,
  onEdit,
  onDelete,
  onReport,
  onShare,
}: ForumPostDetailProps) {
  return (
    <Card as="article" padding="lg" className="community-detail">
      <div className="community-post-meta">
        <span>{getForumWriter(post)}</span>
        <time dateTime={post.createdAt}>{post.createdAt?.replace('T', ' ').slice(0, 16)}</time>
      </div>
      <h2>{post.title}</h2>
      <p className="community-detail__content">{post.content}</p>

      {post.promoUrl && (
        <div className="community-promo-link">
          <div>
            <Badge tone="info">프로모션 링크</Badge>
            <a href={post.promoUrl} target="_blank" rel="noreferrer">
              {post.promoUrl} <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
          {onShare && <Button variant="secondary" size="sm" icon={Share2} onClick={onShare}>공유</Button>}
        </div>
      )}

      <div className="community-detail__footer">
        <div className="community-actions">
          <Button variant={liked ? 'primary' : 'secondary'} size="sm" icon={ThumbsUp} aria-pressed={liked} onClick={onLike}>
            좋아요 {getForumLikeCount(post)}
          </Button>
          <Badge tone="neutral">{feedbackLabel} {post.commentCount ?? 0}</Badge>
          {onReport && <Button variant="ghost" size="sm" icon={AlertCircle} onClick={onReport}>신고</Button>}
        </div>
        {(onEdit || onDelete) && (
          <div className="community-actions">
            {onEdit && <Button variant="ghost" size="sm" icon={Pencil} onClick={onEdit}>수정</Button>}
            {onDelete && <Button variant="danger" size="sm" icon={Trash2} onClick={onDelete}>삭제</Button>}
          </div>
        )}
      </div>
    </Card>
  );
}
