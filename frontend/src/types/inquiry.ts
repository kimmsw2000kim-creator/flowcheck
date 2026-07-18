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
  updatedAt: string;
  answeredAt: string | null;
}

export interface CreateInquiryRequest {
  title: string;
  content: string;
}

export type UpdateInquiryRequest = CreateInquiryRequest;

export interface InquiryPage {
  content: Inquiry[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}
