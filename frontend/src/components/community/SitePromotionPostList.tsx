import CommunityPostList from './CommunityPostList';

export default function SitePromotionPostList({ refreshKey }: { refreshKey: number }) {
  return <CommunityPostList category="SITE_PROMOTION" refreshKey={refreshKey} title="사이트 홍보 게시글" emptyTitle="등록된 사이트 홍보 게시글이 없습니다." emptyDescription="첫 번째 사이트 홍보 게시글을 작성해 보세요." />;
}
