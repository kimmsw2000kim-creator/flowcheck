import type { CouponType } from '../../types/payment';
import { Button, Card } from '../common';

interface CouponPackageSectionProps {
  onBuyCoupons: (count: number, couponType: CouponType) => Promise<void>;
}

interface CouponCardProps {
  title: string;
  price: string;
  count: number;
  couponType: CouponType;
  onBuyCoupons: CouponPackageSectionProps['onBuyCoupons'];
}

function CouponCard({ title, price, count, couponType, onBuyCoupons }: CouponCardProps) {
  return (
    <Card variant="subtle" padding="sm" className="payment-coupon-card">
      <strong>{title}</strong>
      <span>가격: {price} 크레딧</span>
      <Button fullWidth onClick={() => void onBuyCoupons(count, couponType)}>구매하기</Button>
    </Card>
  );
}

export default function CouponPackageSection({ onBuyCoupons }: CouponPackageSectionProps) {
  return (
    <Card as="section" padding="md" className="payment-coupons">
      <div className="payment-section-heading">
        <div>
          <span>Prepaid Coupons</span>
          <h3>선결제 테스트 쿠폰 패키지</h3>
        </div>
      </div>

      <h4>부하 테스트 쿠폰 패키지</h4>
      <div className="payment-coupons__grid">
        <CouponCard title="부하 5회 쿠폰 패키지" price="50,000" count={5} couponType="LOAD_TEST" onBuyCoupons={onBuyCoupons} />
        <CouponCard title="부하 10회 쿠폰 패키지" price="100,000" count={10} couponType="LOAD_TEST" onBuyCoupons={onBuyCoupons} />
      </div>

      <h4>UI/UX 테스트 쿠폰 패키지</h4>
      <div className="payment-coupons__grid">
        <CouponCard title="UI 5회 쿠폰 패키지" price="5,000" count={5} couponType="UIUX_TEST" onBuyCoupons={onBuyCoupons} />
        <CouponCard title="UI 10회 쿠폰 패키지" price="10,000" count={10} couponType="UIUX_TEST" onBuyCoupons={onBuyCoupons} />
      </div>
    </Card>
  );
}
