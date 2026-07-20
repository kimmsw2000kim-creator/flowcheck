import { Coins, Ticket } from 'lucide-react';
import type { CurrentUser } from '../../store/userStore';
import { Card } from '../common';

interface PaymentBalanceHeaderProps {
  currentUser: CurrentUser;
}

export default function PaymentBalanceHeader({ currentUser }: PaymentBalanceHeaderProps) {
  return (
    <Card as="section" padding="lg" className="payment-balance" aria-label="계정 잔액 요약">
      <div className="payment-balance__primary">
        <span>내 계정 크레딧 잔액</span>
        <strong>{(currentUser.balance || 0).toLocaleString()} <small>C</small></strong>
      </div>

      <div className="payment-balance__stats">
        <div>
          <Ticket size={20} aria-hidden="true" />
          <span>UIUX 테스트 쿠폰</span>
          <strong>{(currentUser.UIUXTestCoupons || 0).toLocaleString()}개</strong>
        </div>
        <div>
          <Ticket size={20} aria-hidden="true" />
          <span>부하 테스트 쿠폰</span>
          <strong>{(currentUser.loadTestCoupons || 0).toLocaleString()}개</strong>
        </div>
      </div>
    </Card>
  );
}
