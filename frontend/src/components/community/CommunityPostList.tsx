import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { fetchCommunityPosts } from '../../api/communityPostApi';
import type { Post, PostCategory } from '../../types/post';
import { Badge, Button, Card, EmptyState } from '../common';

interface CommunityPostListProps {
  category: PostCategory;
  refreshKey: number;
  title: string;
  emptyTitle: string;
  emptyDescription: string;
}

export default function CommunityPostList({ category, refreshKey, title, emptyTitle, emptyDescription }: CommunityPostListProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const page = await fetchCommunityPosts({ category, page: 0, size: 10, sort: 'createdAt,desc' });
        if (!cancelled) setPosts(page.content);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : '게시글을 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [category, refreshKey]);

  if (loading) return <EmptyState title="게시글을 불러오는 중입니다." description="잠시만 기다려 주세요." aria-live="polite" />;
  if (error) return <EmptyState title={error} description="잠시 후 다시 시도해 주세요." />;
  if (posts.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <section className="community-feed" aria-labelledby={`feed-${category}`}>
      <h2 id={`feed-${category}`}>{title}</h2>
      <div className="community-feed__list">
        {posts.map((post) => (
          <Card as="article" key={post.id} variant="outlined">
            <div className="community-post-meta"><span>{post.writerEmail}</span><time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString('ko-KR')}</time></div>
            <h3>{post.title}</h3>
            <p className="community-feed__content">{post.content}</p>
            <div className="community-feed__footer">
              {post.testRequestId && <Badge tone="success">테스트 결과 연결 완료</Badge>}
              {post.promoUrl && <Button variant="secondary" size="sm" icon={ExternalLink} onClick={() => window.open(post.promoUrl || '', '_blank', 'noopener,noreferrer')}>사이트 방문</Button>}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
