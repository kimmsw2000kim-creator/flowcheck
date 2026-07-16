import { Check, CreditCard, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CREDIT_PRODUCTS } from '../../hooks/usePayment';
import { Badge, Button, Card } from '../common';
import LandingSectionHeader from './LandingSectionHeader';
import styles from '../../styles/landing.module.css';

const TEST_BENEFITS = ['부하 테스트와 UI/UX 테스트 지원', '실시간 실행 상태와 결과 보고서', '테스트 이력 및 커뮤니티 공유', '필요한 만큼만 충전하는 크레딧 방식'] as const;

export default function PricingSection() {
  const navigate = useNavigate();
  return (
    <section id="pricing" className={styles.section}>
      <LandingSectionHeader eyebrow="Flexible Pricing" title="사용량 기반 크레딧" description="월 고정 비용 없이 필요한 테스트만 실행하고 크레딧으로 결제합니다." />
      <div className={styles['pricing-layout']}>
        <Card as="article" variant="outlined" padding="lg" className={styles['usage-card']}>
          <div className={styles['card-heading']}><span className={styles['feature-icon']}><CreditCard size={24} aria-hidden="true" /></span><div><Badge tone="info">Usage Based</Badge><h3>테스트 실행 요금</h3></div></div>
          <div className={styles['usage-price']}><span>기준 실행 단가</span><strong>10,000 <small>크레딧</small></strong></div>
          <ul className={styles['benefit-list']}>
            {TEST_BENEFITS.map((benefit) => <li key={benefit}><Check size={16} aria-hidden="true" /> {benefit}</li>)}
          </ul>
          <div className={styles['security-note']}><Shield size={17} aria-hidden="true" /><span>토스페이먼츠를 통한 안전한 결제 환경</span></div>
          <Button fullWidth onClick={() => navigate('/signup')}>회원가입 후 시작하기</Button>
        </Card>

        <div className={styles['product-list']} aria-label="크레딧 충전 상품">
          {CREDIT_PRODUCTS.map((product) => {
            const savings = product.credits - product.price;
            return (
              <Card as="article" key={product.id} variant={product.id === 'CREDIT_100K' ? 'default' : 'outlined'} padding="md" className={styles['product-card']}>
                <div><Badge tone={product.badgeTone}>{product.badge}</Badge><h3>{product.title}</h3><p>{product.description}</p></div>
                <dl><div><dt>충전 크레딧</dt><dd>{product.credits.toLocaleString()} C</dd></div><div><dt>결제 금액</dt><dd>{product.price.toLocaleString()}원</dd></div></dl>
                {savings > 0 && <Badge tone="success">정가 대비 {savings.toLocaleString()}원 절약</Badge>}
              </Card>
            );
          })}
          <Button fullWidth onClick={() => navigate('/signup')}>크레딧 패키지 이용하기</Button>
        </div>
      </div>
    </section>
  );
}
