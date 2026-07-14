import { CreditCard, RefreshCw, ShieldCheck } from 'lucide-react';
import type { CreditProduct } from '../../types/payment';

interface TossPaymentPanelProps {
  product: CreditProduct;
  widgetReady: boolean;
  onRequestPayment: () => Promise<void>;
  onCancel: () => void;
}

export default function TossPaymentPanel({
  product,
  widgetReady,
  onRequestPayment,
  onCancel,
}: TossPaymentPanelProps) {
  return (
    <div className="card" style={{
      marginBottom: '2rem',
      border: '1px solid var(--accent-border)',
      borderRadius: '1rem',
      padding: '2rem',
      backgroundColor: 'var(--bg-secondary)',
      boxShadow: 'var(--card-shadow)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>주문 결제서</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            선택하신 충전 금액과 상품을 확인하고 아래에서 결제를 진행해 주세요.
          </p>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '1.25rem',
          borderRadius: '0.75rem',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--bg-tertiary)',
        }}>
          <div style={{
            background: 'var(--accent)',
            color: '#ffffff',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <CreditCard size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{product.title}</strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{product.description}</span>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          padding: '1rem',
          borderRadius: '0.75rem',
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          textAlign: 'center',
        }}>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>크레딧</label>
            <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{product.credits.toLocaleString()} C</strong>
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>결제 금액</label>
            <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{product.price.toLocaleString()} 원</strong>
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>상품 코드</label>
            <strong style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{product.id}</strong>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <div id="payment-method" style={{ minHeight: '280px', backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }} />
          <div id="agreement" style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }} />

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => void onRequestPayment()}
              className="btn btn-primary"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.85rem', fontSize: '1rem' }}
              disabled={!widgetReady}
            >
              {!widgetReady && <RefreshCw className="animate-spin" size={16} />}
              <span>{product.price.toLocaleString()}원 결제하기</span>
            </button>
            <button onClick={onCancel} className="btn btn-secondary" style={{ flex: 0.3 }}>
              취소
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <ShieldCheck size={14} style={{ color: 'var(--success)' }} />
          <span>토스페이먼츠 보안 암호화 결제 시스템이 적용되어 있습니다.</span>
        </div>
      </div>
    </div>
  );
}
