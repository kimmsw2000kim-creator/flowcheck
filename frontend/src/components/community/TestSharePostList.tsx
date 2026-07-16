import CommunityPostList from './CommunityPostList';

export default function TestSharePostList({ refreshKey }: { refreshKey: number }) {
  return <CommunityPostList category="TEST_SHARE" refreshKey={refreshKey} title="공유된 테스트 결과" emptyTitle="공유된 테스트 결과가 없습니다." emptyDescription="완료된 테스트 결과를 처음으로 공유해 보세요." />;
}
