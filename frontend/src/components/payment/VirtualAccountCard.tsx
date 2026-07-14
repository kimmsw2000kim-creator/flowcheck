import type { VirtualAccountDetails } from '../../types/payment';

interface VirtualAccountCardProps {
  account: VirtualAccountDetails;
}

export default function VirtualAccountCard({ account }: VirtualAccountCardProps) {
  return (
    <div className="card" style={{
      marginBottom: '2rem',
      background: 'var(--bg-secondary)',
      padding: '1.5rem',
      borderRadius: '1rem',
      border: '2px dashed var(--success)',
      boxShadow: 'var(--card-shadow)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
        <h4 style={{ color: 'var(--success)', margin: 0, fontWeight: 700, fontSize: '1.1rem' }}>가상계좌 입금 대기 안내</h4>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.9rem', marginBottom: '1rem' }}>
        <div style={{ color: 'var(--text-secondary)' }}>입금 은행:</div>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{account.bank}</div>
        <div style={{ color: 'var(--text-secondary)' }}>계좌 번호:</div>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'underline' }}>{account.accountNumber}</div>
        <div style={{ color: 'var(--text-secondary)' }}>예금주 명:</div>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{account.customerName}</div>
        <div style={{ color: 'var(--text-secondary)' }}>입금 금액:</div>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{account.amount.toLocaleString()} 원</div>
        <div style={{ color: 'var(--text-secondary)' }}>입금 기한:</div>
        <div style={{ fontWeight: 700, color: 'var(--error)' }}>{account.dueDate} 까지</div>
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
        ⚠️ 상기 발급 계좌로 결제 기한 내에 이체해 주시면 백엔드 자동 입금 확인 웹훅을 통해 실시간으로 잔액이 충전됩니다.
      </p>
    </div>
  );
}
