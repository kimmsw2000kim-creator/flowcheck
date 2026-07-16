import type { VirtualAccountDetails } from '../../types/payment';
import { Badge, Card } from '../common';

interface VirtualAccountCardProps {
  account: VirtualAccountDetails;
}

export default function VirtualAccountCard({ account }: VirtualAccountCardProps) {
  return (
    <Card as="section" variant="outlined" padding="md" className="payment-virtual-account">
      <div className="payment-virtual-account__heading">
        <div>
          <span>Virtual Account</span>
          <h3>가상계좌 입금 안내</h3>
        </div>
        <Badge tone="warning">입금 대기</Badge>
      </div>
      <dl className="payment-virtual-account__details">
        <dt>입금 은행</dt><dd>{account.bank}</dd>
        <dt>계좌 번호</dt><dd className="payment-virtual-account__number">{account.accountNumber}</dd>
        <dt>예금주명</dt><dd>{account.customerName}</dd>
        <dt>입금 금액</dt><dd>{account.amount.toLocaleString()}원</dd>
        <dt>입금 기한</dt><dd className="payment-virtual-account__due-date">{account.dueDate}까지</dd>
      </dl>
      <p>발급된 계좌로 결제 기한 내에 이체하면 입금 확인 후 잔액이 자동으로 충전됩니다.</p>
    </Card>
  );
}
