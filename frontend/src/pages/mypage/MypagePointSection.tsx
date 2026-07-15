import type { MypageData } from '../../types/mypage';
import { Card, EmptyState, PageHeader } from '../../components/common';
import styles from '../../styles/mypage.module.css';

interface MypagePointSectionProps {
  data: MypageData;
}

function MypagePointSection({ data }: MypagePointSectionProps) {
  const balances = [
    { label: '보유 포인트', value: `${data.balance.toLocaleString()}P` },
    { label: '부하 테스트 쿠폰', value: `${data.loadTestCouponCount}회` },
    { label: 'UI/UX 테스트 쿠폰', value: `${data.UIUXTestCouponCount}회` },
  ];

  return (
    <section className={styles['mypage-section']}>
      <PageHeader
        headingLevel={1}
        eyebrow="BALANCE"
        title="쿠폰 · 포인트"
        description="보유 포인트와 테스트 쿠폰 현황을 확인할 수 있습니다."
      />
      <div className={styles['mypage-summary-grid']}>
        {balances.map((item) => (
          <Card className={styles['mypage-summary-card']} key={item.label}>
            <strong>{item.label}</strong>
            <span>{item.value}</span>
          </Card>
        ))}
      </div>
      {data.couponCount === 0 && (
        <EmptyState title="보유한 쿠폰이 없습니다." description="쿠폰을 구매하거나 이벤트 쿠폰을 등록하면 여기에 표시됩니다." />
      )}
    </section>
  );
}

export default MypagePointSection;
