import type { MypageData } from '../../types/mypage';
import styles from '../../styles/mypage.module.css';

interface MypagePointSectionProps {
  data: MypageData;
}

function MypagePointSection({ data }: MypagePointSectionProps) {
  return (
    <section className={styles['mypage-section']}>
      <h1>쿠폰 · 포인트</h1>
      <p>보유 포인트와 쿠폰 현황을 확인할 수 있습니다.</p>

      <div className={styles['mypage-section-card']}>
        <strong>보유 포인트</strong>
        <span>{data.balance.toLocaleString()}P</span>
      </div>

      <div className={styles['mypage-section-card']}>
        <strong>보유 쿠폰 (부하 테스트)</strong>
        <span>{data.loadTestCouponCount}회</span>
      </div>

      <div className={styles['mypage-section-card']}>
        <strong>보유 쿠폰 (UI/UX 테스트)</strong>
        <span>{data.uiUxTestCouponCount}회</span>
      </div>

      {data.couponCount === 0 && (
        <div className={styles['empty-state']}>
          <strong>보유한 쿠폰이 없습니다.</strong>
          <p>쿠폰을 구매하거나 이벤트 쿠폰을 등록하면 여기에 표시됩니다.</p>
        </div>
      )}
    </section>
  );
}

export default MypagePointSection;