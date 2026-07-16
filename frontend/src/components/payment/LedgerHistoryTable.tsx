import { History } from 'lucide-react';
import { useLedgerStore } from '../../store/ledgerStore';
import { Card, EmptyState, Table, TableContainer } from '../common';

function getLedgerTypeLabel(type: string): string {
  if (type === 'CHARGE') return '크레딧 충전';
  if (type === 'COUPON_BUY') return '쿠폰 패키지 구매';
  if (type === 'PROMOTION') return '프로모션 보상';
  if (type === 'TEST_CONSUME') return '테스트 차감';
  return type;
}

export default function LedgerHistoryTable() {
  const ledger = useLedgerStore((state) => state.entries);

  return (
    <Card as="section" padding="md" className="payment-ledger">
      <div className="payment-section-heading">
        <History size={20} aria-hidden="true" />
        <div>
          <span>Ledger</span>
          <h3>크레딧 거래 내역</h3>
        </div>
      </div>
      <TableContainer className="payment-ledger__table-container">
        <Table density="compact">
          <thead>
            <tr>
              <th>거래 유형</th>
              <th className="payment-ledger__amount">변동 금액</th>
              <th className="payment-ledger__date">거래 일시</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong className="payment-ledger__type">{getLedgerTypeLabel(item.type)}</strong>
                  <small className="payment-ledger__description">
                    {item.description ? item.description.split(' - 주문번호:')[0] : ''}
                  </small>
                </td>
                <td className="payment-ledger__amount" data-positive={item.amount > 0 ? 'true' : 'false'}>
                  {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()}
                </td>
                <td className="payment-ledger__date">{item.createdAt}</td>
              </tr>
            ))}
            {ledger.length === 0 && (
              <tr>
                <td colSpan={3}>
                  <EmptyState title="거래 내역이 없습니다." description="충전이나 쿠폰 구매 후 거래 내역이 표시됩니다." />
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </TableContainer>
    </Card>
  );
}
