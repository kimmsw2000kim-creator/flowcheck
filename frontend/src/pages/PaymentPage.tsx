import { RefreshCw } from 'lucide-react';
import { Card, PageHeader } from '../components/common';
import CouponPackageSection from '../components/payment/CouponPackageSection';
import CreditPackageSelector from '../components/payment/CreditPackageSelector';
import LedgerHistoryTable from '../components/payment/LedgerHistoryTable';
import PaymentBalanceHeader from '../components/payment/PaymentBalanceHeader';
import TossPaymentPanel from '../components/payment/TossPaymentPanel';
import VirtualAccountCard from '../components/payment/VirtualAccountCard';
import { usePayment } from '../hooks/usePayment';
import '../styles/PaymentPage.css';

export default function PaymentPage() {
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
  } = usePayment();

  return (
    <div className="payment-page">
      <PageHeader
        headingLevel={2}
        title="크레딧 및 결제"
        description="크레딧 충전, 테스트 쿠폰 구매와 최근 거래 내역을 관리합니다."
      />

      <PaymentBalanceHeader currentUser={currentUser} />

      {isProcessing && (
        <Card padding="sm" variant="subtle" className="payment-page__processing" role="status" aria-live="polite">
          <RefreshCw className="payment-page__spinner" size={18} aria-hidden="true" />
          <span>결제 처리를 진행 중입니다. 잠시만 기다려 주세요.</span>
        </Card>
      )}

      <CreditPackageSelector
        products={products}
        selectedProduct={selectedProduct}
        onSelectProduct={selectProduct}
      />

      <div className="payment-page__columns">
        <div className="payment-page__purchase-column">
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

        <LedgerHistoryTable />
      </div>
    </div>
  );
}
