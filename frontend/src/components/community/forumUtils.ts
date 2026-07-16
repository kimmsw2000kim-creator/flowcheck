import type { ForumPost } from '../../types/community';

export function getForumWriter(post: ForumPost) {
  return post.writerEmail || post.email || 'unknown';
}

export function getForumLikeCount(post: ForumPost) {
  return post.likeCount ?? post.likes ?? 0;
}
