import apiClient from './client';
import type { AxiosRequestConfig } from 'axios';
import type {
  CouponType,
  LedgerItem,
  PaymentConfirmResponse,
  PaymentHistoryItem,
  PaymentInitiateResponse,
} from '../types/payment';

interface ConfirmPaymentRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export async function initiatePayment(
  amount: number,
  signal?: AbortSignal,
): Promise<PaymentInitiateResponse> {
  const response = await apiClient.post<PaymentInitiateResponse>(
    '/api/payment/initiate',
    { amount },
    { signal },
  );
  return response.data;
}

export async function confirmPayment(
  request: ConfirmPaymentRequest,
): Promise<PaymentConfirmResponse> {
  const response = await apiClient.post<PaymentConfirmResponse>(
    '/api/payment/confirm',
    request,
  );
  return response.data;
}

export async function buyPaymentCoupons(
  count: number,
  couponType: CouponType,
): Promise<void> {
  await apiClient.post('/api/payment/buy-coupons', { count, couponType });
}

export async function fetchPaymentHistory(
  config?: AxiosRequestConfig,
): Promise<PaymentHistoryItem[]> {
  const response = await apiClient.get<PaymentHistoryItem[]>('/api/payment/history', config);
  return response.data;
}

export async function refundPayment(paymentId: number, reason?: string): Promise<void> {
  await apiClient.post(`/api/payment/${paymentId}/refund`, {
    reason: reason || '사용자 요청에 따른 크레딧 환불',
  });
}

export async function fetchCreditsLedger(
  config?: AxiosRequestConfig,
): Promise<LedgerItem[]> {
  const response = await apiClient.get<LedgerItem[]>('/api/payment/ledger', config);
  return response.data;
}
