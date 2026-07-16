import MypageSiteList from '../../components/MypageSiteList';
import { PageHeader } from '../../components/common';
import type { SiteSummary } from '../../types/mypage';
import styles from '../../styles/mypage.module.css';

interface MypageVerifiedSitesSectionProps {
  sites: SiteSummary[];
}

function MypageVerifiedSitesSection({ sites }: MypageVerifiedSitesSectionProps) {
  return (
    <section className={styles['mypage-section']}>
      <PageHeader
        headingLevel={1}
        eyebrow="DOMAINS"
        title="인증된 사이트"
        description="등록한 사이트의 도메인과 인증 상태를 확인할 수 있습니다."
      />
      <MypageSiteList sites={sites} />
    </section>
  );
}

export default MypageVerifiedSitesSection;
