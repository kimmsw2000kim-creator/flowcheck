import { CreditCard, ShieldCheck } from 'lucide-react';
import type { CreditProduct } from '../../types/payment';
import { Badge, Button, Card } from '../common';

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
    <Card as="section" variant="outlined" padding="md" className="payment-order" aria-busy={!widgetReady}>
      <div className="payment-order__heading">
        <div>
          <span>Checkout</span>
          <h3>주문 결제서</h3>
          <p>선택한 상품을 확인하고 토스페이먼츠 결제를 진행해 주세요.</p>
        </div>
        <Badge tone={widgetReady ? 'success' : 'info'}>{widgetReady ? '결제 준비 완료' : '결제 준비 중'}</Badge>
      </div>

      <div className="payment-order__product">
        <div className="payment-order__product-icon"><CreditCard size={20} aria-hidden="true" /></div>
        <div>
          <strong>{product.title}</strong>
          <span>{product.description}</span>
        </div>
      </div>

      <dl className="payment-order__summary">
        <div><dt>크레딧</dt><dd>{product.credits.toLocaleString()} C</dd></div>
        <div><dt>결제 금액</dt><dd>{product.price.toLocaleString()}원</dd></div>
        <div><dt>상품 코드</dt><dd>{product.id}</dd></div>
      </dl>

      <div className="payment-order__widget" aria-busy={!widgetReady}>
        <div id="payment-method" className="payment-order__widget-slot payment-order__widget-slot--method" />
        <div id="agreement" className="payment-order__widget-slot" />
      </div>

      <div className="payment-order__actions">
        <Button
          onClick={() => void onRequestPayment()}
          variant="primary"
          size="lg"
          fullWidth
          isLoading={!widgetReady}
          loadingText="결제 모듈 준비 중..."
        >
          {product.price.toLocaleString()}원 결제하기
        </Button>
        <Button onClick={onCancel} variant="secondary" size="lg">취소</Button>
      </div>

      <p className="payment-order__security">
        <ShieldCheck size={14} aria-hidden="true" />
        토스페이먼츠 보안 암호화 결제 시스템이 적용되어 있습니다.
      </p>
    </Card>
  );
}
