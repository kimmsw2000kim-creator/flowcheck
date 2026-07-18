export type InquiryStatus = 'PENDING' | 'ANSWERED';

export interface Inquiry {
  id: number;
  userId: string;
  userEmail: string;
  title: string;
  content: string;
  status: InquiryStatus;
  answer: string | null;
  createdAt: string;
  answeredAt: string | null;
}

export interface CreateInquiryRequest {
  title: string;
  content: string;
}
