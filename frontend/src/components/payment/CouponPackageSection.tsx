import { Gift } from 'lucide-react';
import Button from '../common/Button';
import type { CouponType } from '../../types/payment';

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
    <div className="card" style={{ background: 'var(--bg-tertiary)', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
      <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>가격: {price} 크레딧</div>
      <Button style={{ width: '100%' }} onClick={() => void onBuyCoupons(count, couponType)}>
        구매하기
      </Button>
    </div>
  );
}

export default function CouponPackageSection({ onBuyCoupons }: CouponPackageSectionProps) {
  return (
    <div className="card" style={{ borderRadius: '1rem', padding: '1.75rem', backgroundColor: 'var(--bg-secondary)', boxShadow: 'var(--card-shadow)' }}>
      <h3 style={{ marginBottom: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
        <Gift size={18} style={{ color: 'var(--accent)' }} />
        <span>선결제 테스트 쿠폰 패키지 구매</span>
      </h3>

      <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>📊 부하 테스트 쿠폰 패키지</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <CouponCard title="부하 5회 쿠폰 패키지" price="50,000" count={5} couponType="LOAD_TEST" onBuyCoupons={onBuyCoupons} />
        <CouponCard title="부하 10회 쿠폰 패키지" price="100,000" count={10} couponType="LOAD_TEST" onBuyCoupons={onBuyCoupons} />
      </div>

      <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>🎨 UI/UX 테스트 쿠폰 패키지</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        <CouponCard title="UI 5회 쿠폰 패키지" price="5,000" count={5} couponType="UIUX_TEST" onBuyCoupons={onBuyCoupons} />
        <CouponCard title="UI 10회 쿠폰 패키지" price="10,000" count={10} couponType="UIUX_TEST" onBuyCoupons={onBuyCoupons} />
      </div>
    </div>
  );
}
