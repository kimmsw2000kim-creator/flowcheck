import { Coins, Ticket } from 'lucide-react';
import type { CurrentUser } from '../../store/userStore';

interface PaymentBalanceHeaderProps {
  currentUser: CurrentUser;
}

export default function PaymentBalanceHeader({ currentUser }: PaymentBalanceHeaderProps) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)',
      borderRadius: '1.25rem',
      padding: '2.25rem 2.5rem',
      color: '#ffffff',
      boxShadow: '0 10px 25px rgba(2, 132, 199, 0.22)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '2.5rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        right: '-5%',
        top: '-30%',
        width: '240px',
        height: '240px',
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.08)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        left: '30%',
        bottom: '-50%',
        width: '180px',
        height: '180px',
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.04)',
        pointerEvents: 'none',
      }} />

      <div style={{ zIndex: 2 }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9 }}>
          FlowCheck 계정 잔액
        </span>
        <h1 style={{ fontSize: '3rem', fontWeight: 900, margin: '0.25rem 0', textShadow: '0 2px 10px rgba(0, 0, 0, 0.1)' }}>
          {(currentUser.balance || 0).toLocaleString()} <span style={{ fontSize: '1.75rem', fontWeight: 600 }}>C</span>
        </h1>
        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>이메일 계정: {currentUser.email || '게스트'}</p>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', zIndex: 2 }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          borderRadius: '1rem',
          padding: '1rem 1.5rem',
          textAlign: 'center',
          minWidth: '130px',
        }}>
          <Coins size={20} style={{ margin: '0 auto 0.35rem auto', display: 'block', color: '#fef08a' }} />
          <span style={{ fontSize: '0.75rem', display: 'block', opacity: 0.85 }}>충전 포인트</span>
          <strong style={{ fontSize: '1.15rem' }}>{(currentUser.balance || 0).toLocaleString()} P</strong>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          borderRadius: '1rem',
          padding: '1rem 1.5rem',
          textAlign: 'center',
          minWidth: '130px',
        }}>
          <Ticket size={20} style={{ margin: '0 auto 0.35rem auto', display: 'block', color: '#99f6e4' }} />
          <span style={{ fontSize: '0.75rem', display: 'block', opacity: 0.85 }}>보유 테스트 쿠폰</span>
          <strong style={{ fontSize: '1.15rem' }}>{(currentUser.coupons || 0).toLocaleString()} 개</strong>
        </div>
      </div>
    </div>
  );
}
