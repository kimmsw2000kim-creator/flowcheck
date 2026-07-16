import { useSearchParams } from 'react-router-dom';
import { Button, PageHeader } from '../../components/common';
import SitePromotionTab from '../../components/community/SitePromotionTab';
import TestHistoryTab from '../../components/community/TestHistoryTab';
import CommentPage from '../CommentPage';

type CommunityTab = 'tests' | 'promotion' | 'free';
const tabs: CommunityTab[] = ['tests', 'promotion', 'free'];

interface CommunityHubPageProps {
  currentUser: {
    id: string;
    email: string;
    role: string;
    balance: number;
    coupons: number;
  };
  showAlert: (message: string, type?: string) => void;
}

export default function CommunityHubPage({ currentUser, showAlert }: CommunityHubPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab: CommunityTab = requestedTab === 'promotion' || requestedTab === 'free'
    ? requestedTab
    : 'tests';
  const selectTab = (tab: CommunityTab) => setSearchParams({ tab });

  const moveTab = (direction: 1 | -1) => {
    const nextIndex = (tabs.indexOf(activeTab) + direction + tabs.length) % tabs.length;
    selectTab(tabs[nextIndex]);
    requestAnimationFrame(() => document.getElementById(`community-tab-${tabs[nextIndex]}`)?.focus());
  };

  return (
    <div className="community-page community-hub">
      <PageHeader
        eyebrow="Community Preview"
        title="커뮤니티"
        description="테스트 결과를 공유하거나 인증된 사이트를 소개할 수 있습니다."
      />
      <nav className="community-tabs" role="tablist" aria-label="커뮤니티 메뉴" onKeyDown={(event) => {
        if (event.key === 'ArrowRight') { event.preventDefault(); moveTab(1); }
        if (event.key === 'ArrowLeft') { event.preventDefault(); moveTab(-1); }
        if (event.key === 'Home') { event.preventDefault(); selectTab(tabs[0]); }
        if (event.key === 'End') { event.preventDefault(); selectTab(tabs[tabs.length - 1]); }
      }}>
        <Button id="community-tab-tests" role="tab" aria-selected={activeTab === 'tests'} aria-controls="community-panel-tests" tabIndex={activeTab === 'tests' ? 0 : -1} variant={activeTab === 'tests' ? 'primary' : 'secondary'} onClick={() => selectTab('tests')}>테스트 이력</Button>
        <Button id="community-tab-promotion" role="tab" aria-selected={activeTab === 'promotion'} aria-controls="community-panel-promotion" tabIndex={activeTab === 'promotion' ? 0 : -1} variant={activeTab === 'promotion' ? 'primary' : 'secondary'} onClick={() => selectTab('promotion')}>내 사이트 홍보</Button>
        <Button id="community-tab-free" role="tab" aria-selected={activeTab === 'free'} aria-controls="community-panel-free" tabIndex={activeTab === 'free' ? 0 : -1} variant={activeTab === 'free' ? 'primary' : 'secondary'} onClick={() => selectTab('free')}>자유게시판</Button>
      </nav>
      <section id={`community-panel-${activeTab}`} role="tabpanel" aria-labelledby={`community-tab-${activeTab}`} className="community-tab-panel">
        {activeTab === 'tests' && <TestHistoryTab />}
        {activeTab === 'promotion' && <SitePromotionTab />}
        {activeTab === 'free' && (
          <CommentPage
            currentUser={currentUser}
            showAlert={showAlert}
            integrated
          />
        )}
      </section>
    </div>
  );
}
