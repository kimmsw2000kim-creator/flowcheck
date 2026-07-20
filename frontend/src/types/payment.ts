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

export interface PaymentHistoryItem {
  paymentId: number;
  orderId: string;
  paymentKey?: string | null;
  amount: number;
  accountNumber?: string | null;
  bankCode?: string | null;
  customerName?: string | null;
  paymentStatus: string;
  creditedAmount: number;
  refundable: boolean;
  dueDate?: string | null;
  createdAt: string;
}

export interface VirtualAccountDetails {
  bank: string;
  accountNumber: string;
  customerName: string;
  amount: number;
  dueDate: string;
  orderId: string;
}
