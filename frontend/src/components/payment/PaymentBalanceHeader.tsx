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
        <span>FlowCheck 계정 잔액</span>
        <strong>{(currentUser.balance || 0).toLocaleString()} <small>C</small></strong>
        <p>이메일 계정: {currentUser.email || '게스트'}</p>
      </div>

      <div className="payment-balance__stats">
        <div>
          <Coins size={20} aria-hidden="true" />
          <span>충전 포인트</span>
          <strong>{(currentUser.balance || 0).toLocaleString()} P</strong>
        </div>
        <div>
          <Ticket size={20} aria-hidden="true" />
          <span>보유 테스트 쿠폰</span>
          <strong>{(currentUser.coupons || 0).toLocaleString()}개</strong>
        </div>
      </div>
    </Card>
  );
}
