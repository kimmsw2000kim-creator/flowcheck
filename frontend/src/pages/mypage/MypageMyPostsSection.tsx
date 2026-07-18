import { useEffect, useReducer, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMypageCommunityActivities } from '../../api/mypageApi';
import { Badge, Button, Card, EmptyState, PageHeader } from '../../components/common';
import styles from '../../styles/mypage.module.css';
import type {
  MypageActivityFilter,
  MypageCommunityActivityItem,
  MypageCommunityActivityPage,
} from '../../types/mypage';

const filterOptions: { value: MypageActivityFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'POST', label: '게시글' },
  { value: 'COMMENT', label: '댓글' },
];

const categoryLabels: Record<string, string> = {
  TEST_SHARE: '테스트 공유',
  SITE_PROMOTION: '사이트 홍보',
  FREE_BOARD: '자유게시판',
};

const activityLabels: Record<MypageCommunityActivityItem['activityType'], string> = {
  POST: '게시글',
  COMMENT: '댓글',
  REPLY: '답글',
};

const formatDate = (value: string) => new Date(value).toLocaleString('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function MypageMyPostsSection() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<MypageActivityFilter>('ALL');
  const [page, setPage] = useState(0);
  const [retryKey, retry] = useReducer((value) => value + 1, 0);
  const [activityPage, setActivityPage] = useState<MypageCommunityActivityPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setError('');

    fetchMypageCommunityActivities(filter, page)
      .then((result) => {
        if (isActive) setActivityPage(result);
      })
      .catch((requestError: unknown) => {
        if (!isActive) return;
        setError(requestError instanceof Error ? requestError.message : '활동 내역을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [filter, page, retryKey]);

  const changeFilter = (nextFilter: MypageActivityFilter) => {
    // 필터 변경 시 첫 페이지로 이동
    setFilter(nextFilter);
    setPage(0);
  };

  const openOriginalPost = (activity: MypageCommunityActivityItem) => {
    const path = activity.boardType === 'COMMUNITY'
      ? `/community/${activity.postId}`
      : `/community?tab=free&postId=${activity.postId}`;
    navigate(path);
  };

  const activities = activityPage?.content ?? [];
  const totalPages = activityPage?.totalPages ?? 0;

  return (
    <section className={styles['mypage-section']}>
      <PageHeader
        headingLevel={1}
        eyebrow="COMMUNITY"
        title="내 글 · 댓글"
        description="내가 작성한 커뮤니티 게시글과 자유게시판 댓글을 확인할 수 있습니다."
      />

      <div className={styles['activity-toolbar']}>
        <div className={styles['activity-filter']} role="group" aria-label="활동 유형 필터">
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={filter === option.value ? 'primary' : 'secondary'}
              aria-pressed={filter === option.value}
              onClick={() => changeFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <span className={styles['activity-summary']}>총 {activityPage?.totalElements ?? 0}개</span>
      </div>

      {isLoading && <EmptyState title="활동 내역을 불러오는 중입니다." />}
      {!isLoading && error && (
        <EmptyState
          title="활동 내역을 불러오지 못했습니다."
          description={error}
          action={<Button type="button" variant="secondary" onClick={retry}>다시 시도</Button>}
        />
      )}
      {!isLoading && !error && activities.length === 0 && (
        <EmptyState
          title={filter === 'POST' ? '작성한 게시글이 없습니다.' : filter === 'COMMENT' ? '작성한 댓글이 없습니다.' : '작성한 글이나 댓글이 없습니다.'}
          description="커뮤니티에서 활동하면 이곳에 최신순으로 표시됩니다."
        />
      )}
      {!isLoading && !error && activities.length > 0 && (
        <>
          <div className={styles['activity-list']}>
            {activities.map((activity) => (
              <Card as="article" className={styles['activity-card']} key={`${activity.boardType}-${activity.activityType}-${activity.activityId}`}>
                <div className={styles['activity-header']}>
                  <div className={styles['activity-badges']}>
                    <Badge tone="info">{categoryLabels[activity.category] ?? activity.category}</Badge>
                    <Badge tone={activity.activityType === 'POST' ? 'success' : 'neutral'}>
                      {activityLabels[activity.activityType]}
                    </Badge>
                  </div>
                  <time dateTime={activity.createdAt}>{formatDate(activity.createdAt)}</time>
                </div>
                <strong className={styles['activity-title']}>{activity.title}</strong>
                <p className={styles['activity-content']}>{activity.content || '내용 없음'}</p>
                <div className={styles['activity-footer']}>
                  <Button type="button" variant="secondary" size="sm" onClick={() => openOriginalPost(activity)}>
                    원문 보기
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <nav className={styles.pagination} aria-label="내 활동 페이지">
              <Button type="button" variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>이전</Button>
              <span>{page + 1} / {totalPages}</span>
              <Button type="button" variant="secondary" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((current) => current + 1)}>다음</Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

export default MypageMyPostsSection;
