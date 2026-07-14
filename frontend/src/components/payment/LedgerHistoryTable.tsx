import { History } from 'lucide-react';
import type { LedgerItem } from '../../types/payment';

interface LedgerHistoryTableProps {
  ledger: LedgerItem[];
}

function getLedgerTypeLabel(type: string): string {
  if (type === 'CHARGE') return '크레딧 충전';
  if (type === 'COUPON_BUY') return '쿠폰 패키지 구매';
  if (type === 'PROMOTION') return '프로모션 보상';
  if (type === 'TEST_CONSUME') return '테스트 차감';
  return type;
}

export default function LedgerHistoryTable({ ledger }: LedgerHistoryTableProps) {
  return (
    <div className="card" style={{ borderRadius: '1rem', padding: '1.75rem', backgroundColor: 'var(--bg-secondary)', boxShadow: 'var(--card-shadow)' }}>
      <h3 style={{ marginBottom: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
        <History size={18} style={{ color: 'var(--accent)' }} />
        <span>크레딧 거래 내역</span>
      </h3>
      <div className="table-wrapper" style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '0.5rem' }}>
        <table className="custom-table" style={{ fontSize: '0.85rem', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.75rem 1rem' }}>거래 유형</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>변동 금액</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>거래 일시</th>
            </tr>
          </thead>
          <tbody>
            {ledger.length > 0 ? (
              ledger.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {getLedgerTypeLabel(item.type)}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>
                      {item.description ? item.description.split(' - 주문번호:')[0] : ''}
                    </div>
                  </td>
                  <td style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'right',
                    color: item.amount > 0 ? 'var(--success)' : 'var(--error)',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                  }}>
                    {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {item.createdAt}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>거래 내역이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
