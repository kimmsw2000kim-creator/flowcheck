import { ReceiptText } from 'lucide-react';
import { useMemo } from 'react';
import { useLedgerStore } from '../../store/ledgerStore';
import type { LedgerItem, PaymentHistoryItem } from '../../types/payment';
import { Badge, Button, Card, EmptyState, Table, TableContainer } from '../common';

interface PaymentActivityPanelProps {
  payments: PaymentHistoryItem[];
  loading: boolean;
  refundingPaymentId: number | null;
  onRefund: (paymentId: number) => void;
}

type ActivityRow =
  | {
      id: string;
      source: 'payment';
      title: string;
      detail: string;
      badge: string;
      badgeTone: 'success' | 'danger' | 'warning' | 'neutral';
      amount: number;
      amountPrefix: string;
      date: string;
      refundable: boolean;
      paymentId: number;
    }
  | {
      id: string;
      source: 'ledger';
      title: string;
      detail: string;
      badge: string;
      badgeTone: 'success' | 'danger' | 'warning' | 'neutral';
      amount: number;
      amountPrefix: string;
      date: string;
      refundable: false;
      paymentId?: never;
    };

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toTime(value: string | null | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getPaymentBadge(status: string): Pick<ActivityRow, 'badge' | 'badgeTone'> {
  if (status === 'DONE') return { badge: '결제 완료', badgeTone: 'success' };
  if (status === 'CANCELED') return { badge: '환불 완료', badgeTone: 'danger' };
  if (status === 'WAITING_FOR_DEPOSIT') return { badge: '입금 대기', badgeTone: 'warning' };
  return { badge: status, badgeTone: 'neutral' };
}

function getLedgerLabel(type: string): Pick<ActivityRow, 'title' | 'badge' | 'badgeTone'> {
  if (type === 'COUPON_BUY') return { title: '쿠폰 패키지 구매', badge: '쿠폰', badgeTone: 'warning' };
  if (type === 'TEST_CONSUME') return { title: '테스트 크레딧 차감', badge: '차감', badgeTone: 'danger' };
  if (type === 'TEST_REFUND') return { title: '테스트 크레딧 환불', badge: '환불', badgeTone: 'success' };
  if (type === 'PAYMENT_REFUND') return { title: '결제 환불', badge: '환불', badgeTone: 'danger' };
  if (type === 'PROMOTION') return { title: '프로모션 보상', badge: '보상', badgeTone: 'success' };
  return { title: type, badge: '거래', badgeTone: 'neutral' };
}

function cleanLedgerDescription(description: string | undefined): string {
  if (!description) return '';
  return description.split(' - 주문번호:')[0];
}

function buildPaymentRow(payment: PaymentHistoryItem): ActivityRow {
  const badge = getPaymentBadge(payment.paymentStatus);
  return {
    id: `payment-${payment.paymentId}`,
    source: 'payment',
    title: payment.paymentStatus === 'CANCELED' ? '크레딧 충전 결제' : '크레딧 충전',
    detail: `충전 ${payment.creditedAmount.toLocaleString()} C`,
    ...badge,
    amount: payment.amount,
    amountPrefix: '',
    date: payment.createdAt,
    refundable: payment.refundable,
    paymentId: payment.paymentId,
  };
}

function buildLedgerRow(item: LedgerItem): ActivityRow {
  const label = getLedgerLabel(item.type);
  return {
    id: `ledger-${item.id}`,
    source: 'ledger',
    detail: cleanLedgerDescription(item.description),
    ...label,
    amount: item.amount,
    amountPrefix: item.amount > 0 ? '+' : '',
    date: item.createdAt,
    refundable: false,
  };
}

export default function PaymentActivityPanel({
  payments,
  loading,
  refundingPaymentId,
  onRefund,
}: PaymentActivityPanelProps) {
  const ledger = useLedgerStore((state) => state.entries);

  const rows = useMemo(() => {
    const paymentRows = payments.map(buildPaymentRow);
    const ledgerRows = ledger
      .filter((item) => item.type !== 'CHARGE')
      .map(buildLedgerRow);

    return [...paymentRows, ...ledgerRows].sort((a, b) => toTime(b.date) - toTime(a.date));
  }, [ledger, payments]);

  return (
    <Card as="section" padding="md" className="payment-activity">
      <div className="payment-section-heading">
        <ReceiptText size={20} aria-hidden="true" />
        <div>
          <span>History</span>
          <h3>결제 및 크레딧 내역</h3>
        </div>
      </div>

      <TableContainer className="payment-activity__table-container">
        <Table density="compact" className="payment-activity__table">
          <thead>
            <tr>
              <th>내역</th>
              <th className="payment-activity__amount">금액</th>
              <th className="payment-activity__date">일시</th>
              <th className="payment-activity__actions">관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isRefunding = row.source === 'payment' && refundingPaymentId === row.paymentId;
              return (
                <tr key={row.id}>
                  <td>
                    <div className="payment-activity__main">
                      <Badge tone={row.badgeTone} size="sm">{row.badge}</Badge>
                      <strong>{row.title}</strong>
                    </div>
                    {row.detail && <small className="payment-activity__detail">{row.detail}</small>}
                  </td>
                  <td
                    className="payment-activity__amount"
                    data-positive={row.amount > 0 ? 'true' : 'false'}
                  >
                    {row.amountPrefix}{row.amount.toLocaleString()}
                  </td>
                  <td className="payment-activity__date">{formatDate(row.date)}</td>
                  <td className="payment-activity__actions">
                    {row.source === 'payment' && row.refundable ? (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={isRefunding}
                        isLoading={isRefunding}
                        loadingText="처리 중"
                        onClick={() => onRefund(row.paymentId)}
                      >
                        환불
                      </Button>
                    ) : (
                      <span className="payment-activity__unavailable">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <EmptyState
                    title={loading ? '거래 내역을 불러오는 중입니다.' : '거래 내역이 없습니다.'}
                    description="크레딧 충전, 쿠폰 구매, 테스트 사용 내역이 한 목록에 표시됩니다."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </TableContainer>
    </Card>
  );
}
