import { useNavigate, useSearchParams } from 'react-router-dom';

// 기존 마이페이지의 테스트 이력 기능을 재사용하는 컴포넌트입니다.
import TestHistoryTab from '../../components/community/TestHistoryTab';

// 인증된 사용자 사이트를 표시하는 탭입니다.
import SitePromotionTab from '../../components/community/SitePromotionTab';

type CommunityTab = 'tests' | 'promotion';

export default function CommunityHubPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const requestedTab = searchParams.get('tab');

    const activeTab: CommunityTab =
        requestedTab === 'promotion'
            ? 'promotion'
            : 'tests';

    const selectTab = (tab: CommunityTab) => {
        setSearchParams({ tab });
    };

    return (
        <div
            style={{
                maxWidth: '1200px',
                margin: '0 auto',
                textAlign: 'left'
            }}
        >
            <header style={{ marginBottom: '2rem' }}>
                <h1>커뮤니티</h1>
                {/* 프로젝트에 정의되어 있는 공통 보조 글자 색상을 사용합니다. */}
                <p style={{ color: 'var(--text-secondary)' }}>
                    테스트 결과를 공유하거나 본인의 사이트를 소개할 수 있습니다.
                </p>
            </header>

            <nav
                role="tablist"
                aria-label="커뮤니티 메뉴"
                style={{
                    display: 'flex',
                    gap: '0.75rem',
                    marginBottom: '2rem',
                }}
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'tests'}
                    className={
                        activeTab === 'tests'
                            ? 'btn btn-primary'
                            : 'btn btn-secondary'
                    }
                    onClick={() => selectTab('tests')}
                >
                    내 테스트 이력
                </button>

                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'promotion'}
                    className={
                        activeTab === 'promotion'
                            ? 'btn btn-primary'
                            : 'btn btn-secondary'
                    }
                    onClick={() => selectTab('promotion')}
                >
                    내 사이트 홍보
                </button>

                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate('/comment')}
                >
                    자유게시판
                </button>
            </nav>

            {/* 테스트 이력 탭에서는 기존 마이페이지 테스트 이력을 재사용합니다. */}
            {activeTab === 'tests' && <TestHistoryTab />}

            {/* 사이트 홍보 탭에서는 현재 사용자의 인증된 사이트를 표시합니다. */}
            {activeTab === 'promotion' && <SitePromotionTab />}
            
        </div>
    )
}