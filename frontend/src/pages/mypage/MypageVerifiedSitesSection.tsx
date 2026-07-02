import MypageSiteList from '../../components/MypageSiteList';
import type { SiteSummary } from '../../types/mypage';

interface MypageVerifiedSitesSectionProps {
    sites: SiteSummary[];
}

function MypageVerifiedSitesSection({ sites }: MypageVerifiedSitesSectionProps) {
    return (
        <section className="mypage-section">
            <h1>인증된 사이트</h1>
            <p>등록한 사이트의 인증 상태를 확인할 수 있습니다.</p>

            <MypageSiteList sites={sites} />
        </section>
    );
}

export default MypageVerifiedSitesSection;