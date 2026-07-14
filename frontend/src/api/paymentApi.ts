import apiClient from './client';
import type {
  CouponType,
  PaymentConfirmResponse,
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
