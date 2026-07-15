import { Activity, CreditCard, Globe, Ticket } from 'lucide-react';
import MypageStatCard from '../../components/MypageStatCard';
import MypageSiteList from '../../components/MypageSiteList';
import { Card, PageHeader } from '../../components/common';
import type { MypageData } from '../../types/mypage';
import styles from '../../styles/mypage.module.css';

interface MypageProfileSectionProps {
  data: MypageData;
}

function MypageProfileSection({ data }: MypageProfileSectionProps) {
  const avatarLabel = data.email.charAt(0).toUpperCase() || 'F';

  return (
    <section className={styles['mypage-section']}>
      <Card className={styles['mypage-profile-card']} variant="subtle">
        <div className={styles['profile-avatar']} aria-hidden="true">{avatarLabel}</div>
        <PageHeader
          headingLevel={1}
          eyebrow="MY FLOWCHECK"
          title="마이페이지"
          description={data.email}
        />
      </Card>

      <div className={styles['mypage-stats']} aria-label="사용 현황">
        <MypageStatCard icon={CreditCard} label="포인트" value={`${data.balance.toLocaleString()}P`} />
        <MypageStatCard
          icon={Ticket}
          label="쿠폰"
          value={<><span>부하 {data.loadTestCouponCount}회</span><span>UI/UX {data.UIUXTestCouponCount}회</span></>}
        />
        <MypageStatCard icon={Globe} label="인증 사이트" value={`${data.registeredSiteCount}개`} />
        <MypageStatCard icon={Activity} label="총 테스트" value={`${data.testRunCount}회`} />
      </div>

      <PageHeader headingLevel={2} title="등록 사이트" description="현재 계정에 등록된 서비스와 인증 상태입니다." />
      <MypageSiteList sites={data.sites} />
    </section>
  );
}

export default MypageProfileSection;
