import { Activity, CreditCard, Globe, Ticket } from 'lucide-react';

import MypageStatCard from '../../components/MypageStatCard';
import MypageSiteList from '../../components/MypageSiteList';
import type { MypageData } from '../../types/mypage';
import styles from '../../styles/mypage.module.css';

interface MypageProfileSectionProps {
  data: MypageData;
}

function MypageProfileSection({ data }: MypageProfileSectionProps) {
  return (
    <>
      <section className={styles['mypage-header']}>
        <div className={styles['mypage-profile']}>
          <div className={styles['profile-avatar']}>
            {data.email.charAt(0).toUpperCase()}
          </div>

          <div>
            <h1>마이페이지</h1>
            <p>{data.email}</p>
          </div>
        </div>
      </section>

      <section className={styles['mypage-stats']}>
        <MypageStatCard
          icon={CreditCard}
          label="포인트"
          value={`${data.balance.toLocaleString()}P`}
        />

        <MypageStatCard
          icon={Ticket}
          label="쿠폰"
          value={
            <>
            부하: {data.loadTestCouponCount}회 
            <br />
            UI: {data.UIUXTestCouponCount}회
            </>
          }
        />

        <MypageStatCard
          icon={Globe}
          label="인증 사이트"
          value={`${data.registeredSiteCount}개`}
        />

        <MypageStatCard
          icon={Activity}
          label="총 테스트"
          value={`${data.testRunCount}회`}
        />
      </section>

      <MypageSiteList sites={data.sites} />
    </>
  );
}

export default MypageProfileSection;