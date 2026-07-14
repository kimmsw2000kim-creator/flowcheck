import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import type { TossPaymentsWidgets } from '@tosspayments/tosspayments-sdk';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import { buyPaymentCoupons, confirmPayment, initiatePayment } from '../api/paymentApi';
import { fetchMypage } from '../api/mypageApi';
import { supabase } from '../lib/supabaseClient';
import { useAlertStore } from '../store/alertStore';
import { useUserStore } from '../store/userStore';
import type {
  CouponType,
  CreditProduct,
  LedgerItem,
  PaymentInitiateResponse,
  VirtualAccountDetails,
} from '../types/payment';

const PAYMENT_METHOD_SELECTOR = '#payment-method';
const AGREEMENT_SELECTOR = '#agreement';

const creditProducts: CreditProduct[] = [
  {
    id: 'CREDIT_10K',
    title: '스타터 코인팩',
    credits: 10000,
    price: 10000,
    description: '기본 기능 체험을 위한 기본 충전',
    badge: '스타터',
    badgeColor: '#64748b',
  },
  {
    id: 'CREDIT_50K',
    title: '프로 코인팩',
    credits: 50000,
    price: 45000,
    description: '10% 보너스 크레딧 추가 적립 패키지',
    badge: '인기 상품',
    badgeColor: '#0d9488',
  },
  {
    id: 'CREDIT_100K',
    title: '언리미티드 코인팩',
    credits: 100000,
    price: 70000,
    description: '최대 30% 파격 할인가 적용 베스트 팩',
    badge: '최대 할인',
    badgeColor: '#d97706',
  },
];

interface UsePaymentOptions {
  ledgerCount: number;
  onAddLedger: (ledgerItem: LedgerItem) => void;
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || error.message;
  }
  return error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
}

function getCreditsForAmount(amount: number): number {
  return creditProducts.find((product) => product.price === amount)?.credits ?? amount;
}

function createLedgerTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 16);
}

function clearWidgetContainers(): void {
  const methodElement = document.querySelector(PAYMENT_METHOD_SELECTOR);
  const agreementElement = document.querySelector(AGREEMENT_SELECTOR);
  if (methodElement) methodElement.innerHTML = '';
  if (agreementElement) agreementElement.innerHTML = '';
}

export function usePayment({ ledgerCount, onAddLedger }: UsePaymentOptions) {
  const currentUser = useUserStore((state) => state.currentUser);
  const updateUser = useUserStore((state) => state.updateUserBalanceAndCoupons);
  const showAlert = useAlertStore((state) => state.showAlert);

  const [selectedProduct, setSelectedProduct] = useState<CreditProduct | null>(null);
  const [widgets, setWidgets] = useState<TossPaymentsWidgets | null>(null);
  const [widgetReady, setWidgetReady] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<PaymentInitiateResponse | null>(null);
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  const [initiationLoading, setInitiationLoading] = useState(false);
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccountDetails | null>(null);
  const confirmationKeyRef = useRef<string | null>(null);
  const initiationSequenceRef = useRef(0);

  const addLedgerEntry = useCallback((entry: Omit<LedgerItem, 'id' | 'createdAt'>) => {
    onAddLedger({
      ...entry,
      id: ledgerCount + 1,
      createdAt: createLedgerTimestamp(),
    });
  }, [ledgerCount, onAddLedger]);

  const syncCurrentUser = useCallback(async () => {
    const profile = await fetchMypage();
    updateUser({
      balance: profile.balance,
      coupons: profile.couponCount,
      loadTestCoupons: profile.loadTestCouponCount,
      UIUXTestCoupons: profile.UIUXTestCouponCount,
    });
  }, [updateUser]);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const paymentKey = queryParams.get('paymentKey');
    const orderId = queryParams.get('orderId');
    const amountParam = queryParams.get('amount');
    const paymentError = queryParams.get('paymentError');
    const errorMessage = queryParams.get('message');
    const hasPaymentParams = paymentKey || orderId || amountParam || paymentError;

    if (!hasPaymentParams) return;

    window.history.replaceState({}, document.title, window.location.pathname);

    if (paymentError) {
      showAlert(errorMessage || '결제가 취소되었거나 실패했습니다.', 'error');
      return;
    }

    if (!paymentKey || !orderId || !amountParam) return;

    const amount = Number.parseInt(amountParam, 10);
    if (!Number.isFinite(amount)) {
      showAlert('결제 금액 정보가 올바르지 않습니다.', 'error');
      return;
    }

    const confirmationKey = `${paymentKey}:${orderId}:${amount}`;
    if (confirmationKeyRef.current === confirmationKey) return;
    confirmationKeyRef.current = confirmationKey;

    const processConfirmation = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showAlert('결제 승인을 위해 로그인이 필요합니다.', 'error');
        return;
      }

      setConfirmationLoading(true);
      try {
        const response = await confirmPayment({ paymentKey, orderId, amount });

        if (response.status === 'DONE') {
          const creditsAwarded = getCreditsForAmount(amount);
          try {
            await syncCurrentUser();
            addLedgerEntry({
              amount: creditsAwarded,
              type: 'CHARGE',
              description: `토스페이먼츠 결제 완료 - 주문번호: ${orderId}`,
            });
            showAlert('결제가 성공적으로 완료되었습니다! 크레딧이 충전되었습니다.', 'success');
          } catch (error) {
            console.error('Failed to sync updated balance:', error);
            const latestUser = useUserStore.getState().currentUser;
            updateUser({
              balance: latestUser.balance + creditsAwarded,
              coupons: latestUser.coupons,
            });
            showAlert('결제가 완료되었습니다! (잔액 동기화 실패, 새로고침 필요)', 'warning');
          }
          return;
        }

        if (response.status === 'WAITING_FOR_DEPOSIT') {
          const account = response.virtualAccount;
          if (!account) {
            showAlert('가상계좌 정보가 없습니다.', 'error');
            return;
          }
          setVirtualAccount({
            bank: account.bank || account.bankCode || '가상은행',
            accountNumber: account.accountNumber,
            customerName: account.customerName || '고객',
            amount,
            dueDate: account.dueDate
              ? new Date(account.dueDate).toISOString().substring(0, 10)
              : '',
            orderId,
          });
          showAlert('가상계좌가 발급되었습니다. 지정된 계좌로 입금해 주세요.', 'success');
        }
      } catch (error) {
        console.error('Confirm payment failed:', error);
        showAlert(`결제 승인 처리에 실패했습니다: ${getErrorMessage(error)}`, 'error');
      } finally {
        setConfirmationLoading(false);
      }
    };

    void processConfirmation();
  }, [addLedgerEntry, showAlert, syncCurrentUser, updateUser]);

  useEffect(() => {
    const sequence = ++initiationSequenceRef.current;

    if (!selectedProduct) {
      setWidgets(null);
      setWidgetReady(false);
      setPaymentOrder(null);
      setInitiationLoading(false);
      clearWidgetContainers();
      return;
    }

    setWidgets(null);
    setWidgetReady(false);
    setPaymentOrder(null);
    clearWidgetContainers();

    const controller = new AbortController();

    const preparePayment = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (sequence !== initiationSequenceRef.current) return;
      if (!session) {
        showAlert('결제를 진행하려면 로그인이 필요합니다.', 'error');
        setSelectedProduct(null);
        return;
      }

      setInitiationLoading(true);
      try {
        const response = await initiatePayment(selectedProduct.price, controller.signal);
        if (sequence !== initiationSequenceRef.current) return;
        setPaymentOrder(response);
        setWidgetReady(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Initiate payment failed:', error);
        showAlert(`결제 정보를 생성하는 중 오류가 발생했습니다: ${getErrorMessage(error)}`, 'error');
        setSelectedProduct(null);
      } finally {
        if (sequence === initiationSequenceRef.current) {
          setInitiationLoading(false);
        }
      }
    };

    void preparePayment();

    return () => {
      controller.abort();
    };
  }, [selectedProduct, showAlert]);

  useEffect(() => {
    if (!paymentOrder) return;

    let disposed = false;

    const renderWidget = async () => {
      try {
        const tossPayments = await loadTossPayments(paymentOrder.clientKey);
        if (disposed) return;

        const widgetInstance = tossPayments.widgets({
          customerKey: paymentOrder.customerKey,
        });
        await widgetInstance.setAmount({
          currency: 'KRW',
          value: paymentOrder.amount,
        });
        if (disposed) return;

        await Promise.all([
          widgetInstance.renderPaymentMethods({
            selector: PAYMENT_METHOD_SELECTOR,
            variantKey: 'DEFAULT',
          }),
          widgetInstance.renderAgreement({
            selector: AGREEMENT_SELECTOR,
            variantKey: 'AGREEMENT',
          }),
        ]);
        if (disposed) return;

        setWidgets(widgetInstance);
        setWidgetReady(true);
      } catch (error) {
        if (disposed) return;
        console.error('Failed to render Toss widget:', error);
        showAlert('결제 모듈을 불러오는 중 오류가 발생했습니다.', 'error');
      }
    };

    void renderWidget();

    return () => {
      disposed = true;
      clearWidgetContainers();
    };
  }, [paymentOrder, showAlert]);

  const selectProduct = useCallback((product: CreditProduct) => {
    setWidgets(null);
    setWidgetReady(false);
    setPaymentOrder(null);
    clearWidgetContainers();
    setSelectedProduct(product);
  }, []);

  const cancelPayment = useCallback(() => {
    setWidgets(null);
    setWidgetReady(false);
    setPaymentOrder(null);
    clearWidgetContainers();
    setSelectedProduct(null);
  }, []);

  const requestPayment = useCallback(async () => {
    if (!widgets || !paymentOrder || !widgetReady) return;

    try {
      await widgets.requestPayment({
        orderId: paymentOrder.orderId,
        orderName: paymentOrder.orderName,
        successUrl: `${window.location.origin}/billing`,
        failUrl: `${window.location.origin}/billing?paymentError=true`,
      });
    } catch (error) {
      console.error('Payment request error:', error);
      showAlert('결제 요청에 실패했습니다.', 'error');
    }
  }, [paymentOrder, showAlert, widgetReady, widgets]);

  const buyCoupons = useCallback(async (count: number, couponType: CouponType) => {
    const unitPrice = couponType === 'UIUX_TEST' ? 1000 : 10000;
    const cost = count * unitPrice;
    const user = useUserStore.getState().currentUser;

    if (user.balance < cost) {
      showAlert('크레딧 잔액이 부족합니다.', 'error');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      showAlert('쿠폰 구매를 위해 로그인이 필요합니다.', 'error');
      return;
    }

    try {
      await buyPaymentCoupons(count, couponType);
      try {
        await syncCurrentUser();
      } catch (error) {
        console.error('Failed to sync balance after coupon buy:', error);
        const latestUser = useUserStore.getState().currentUser;
        updateUser({
          balance: latestUser.balance - cost,
          coupons: latestUser.coupons + count,
        });
        addLedgerEntry({
          amount: -cost,
          type: 'COUPON_BUY',
          description: `선결제 테스트 쿠폰 구매: ${count}회권 (${couponType === 'LOAD_TEST' ? '부하' : 'UI'})`,
        });
        showAlert(`테스트 쿠폰 ${count}회권을 성공적으로 구매하였습니다! (잔액 동기화 실패)`, 'warning');
        return;
      }

      addLedgerEntry({
        amount: -cost,
        type: 'COUPON_BUY',
        description: `선결제 테스트 쿠폰 구매: ${count}회권 (${couponType === 'LOAD_TEST' ? '부하' : 'UI'})`,
      });
      showAlert(`테스트 쿠폰 ${count}회권을 성공적으로 구매하였습니다!`);
    } catch (error) {
      console.error('Coupon purchase failed:', error);
      showAlert(`쿠폰 구매 처리에 실패했습니다: ${getErrorMessage(error)}`, 'error');
    }
  }, [addLedgerEntry, showAlert, syncCurrentUser, updateUser]);

  return {
    currentUser,
    products: creditProducts,
    selectedProduct,
    paymentOrder,
    isProcessing: confirmationLoading || initiationLoading,
    widgetReady,
    virtualAccount,
    selectProduct,
    cancelPayment,
    requestPayment,
    buyCoupons,
  };
}
