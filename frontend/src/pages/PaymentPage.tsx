import { RefreshCw } from 'lucide-react';
import CouponPackageSection from '../components/payment/CouponPackageSection';
import CreditPackageSelector from '../components/payment/CreditPackageSelector';
import LedgerHistoryTable from '../components/payment/LedgerHistoryTable';
import PaymentBalanceHeader from '../components/payment/PaymentBalanceHeader';
import TossPaymentPanel from '../components/payment/TossPaymentPanel';
import VirtualAccountCard from '../components/payment/VirtualAccountCard';
import { usePayment } from '../hooks/usePayment';
import type { LedgerItem } from '../types/payment';

interface PaymentPageProps {
  ledger: LedgerItem[];
  onAddLedger: (ledgerItem: LedgerItem) => void;
}

export default function PaymentPage({ ledger, onAddLedger }: PaymentPageProps) {
  const {
    currentUser,
    products,
    selectedProduct,
    paymentOrder,
    isProcessing,
    widgetReady,
    virtualAccount,
    selectProduct,
    cancelPayment,
    requestPayment,
    buyCoupons,
  } = usePayment({ ledgerCount: ledger.length, onAddLedger });

  return (
    <div style={{ textAlign: 'left', maxWidth: '1200px', margin: '0 auto', padding: '1rem 0' }}>
      <PaymentBalanceHeader currentUser={currentUser} />

      {isProcessing && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '1rem',
          marginBottom: '1.5rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '0.5rem',
          color: 'var(--accent-hover)',
          border: '1px solid var(--border)',
        }}>
          <RefreshCw className="animate-spin" size={16} />
          <span>결제 처리를 진행 중입니다. 잠시만 기다려 주세요...</span>
        </div>
      )}

      <CreditPackageSelector
        products={products}
        selectedProduct={selectedProduct}
        onSelectProduct={selectProduct}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '2.5rem' }}>
        <div>
          {selectedProduct && paymentOrder && (
            <TossPaymentPanel
              product={selectedProduct}
              widgetReady={widgetReady}
              onRequestPayment={requestPayment}
              onCancel={cancelPayment}
            />
          )}

          {virtualAccount && <VirtualAccountCard account={virtualAccount} />}

          <CouponPackageSection onBuyCoupons={buyCoupons} />
        </div>

        <LedgerHistoryTable ledger={ledger} />
      </div>
    </div>
  );
}
