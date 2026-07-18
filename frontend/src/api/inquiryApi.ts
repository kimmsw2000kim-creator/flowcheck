import apiClient from './client';
import type { CreateInquiryRequest, Inquiry } from '../types/inquiry';

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string; error?: string } } }).response;
    return response?.data?.message || response?.data?.error || fallback;
  }
  return fallback;
}

export async function fetchMyInquiries(): Promise<Inquiry[]> {
  try {
    const response = await apiClient.get<Inquiry[]>('/api/inquiries');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, '문의 내역을 불러오지 못했습니다.'));
  }
}

export async function createInquiry(request: CreateInquiryRequest): Promise<Inquiry> {
  try {
    const response = await apiClient.post<Inquiry>('/api/inquiries', request);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, '문의 등록에 실패했습니다.'));
  }
}

export async function fetchAdminInquiries(): Promise<Inquiry[]> {
  try {
    const response = await apiClient.get<Inquiry[]>('/api/admin/inquiries');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, '고객 문의를 불러오지 못했습니다.'));
  }
}

export async function answerInquiry(inquiryId: number, answer: string): Promise<Inquiry> {
  try {
    const response = await apiClient.patch<Inquiry>(
      `/api/admin/inquiries/${inquiryId}/answer`,
      { answer },
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, '답변 등록에 실패했습니다.'));
  }
}
