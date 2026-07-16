export interface LedgerItem {
  id: number;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
  source?: 'server' | 'optimistic';
}

export interface CreditProduct {
  id: string;
  title: string;
  credits: number;
  price: number;
  description: string;
  badge: string;
  badgeTone: 'neutral' | 'success' | 'warning';
}

export type CouponType = 'LOAD_TEST' | 'UIUX_TEST';

export interface PaymentInitiateResponse {
  clientKey: string;
  customerKey: string;
  orderId: string;
  orderName: string;
  amount: number;
}

export interface PaymentVirtualAccountResponse {
  bank?: string;
  bankCode?: string;
  accountNumber: string;
  customerName?: string;
  dueDate?: string;
}

export interface PaymentConfirmResponse {
  status: 'DONE' | 'WAITING_FOR_DEPOSIT' | string;
  virtualAccount?: PaymentVirtualAccountResponse;
}

export interface VirtualAccountDetails {
  bank: string;
  accountNumber: string;
  customerName: string;
  amount: number;
  dueDate: string;
  orderId: string;
}
