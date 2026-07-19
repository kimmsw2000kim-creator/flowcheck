import apiClient from './client';
import type { AdminStats } from '../types/adminStats';

export async function fetchAdminStats(): Promise<AdminStats> {
  try {
    const response = await apiClient.get<AdminStats>('/api/admin/stats');
    return response.data;
  } catch (error) {
    const message = typeof error === 'object' && error && 'response' in error
      ? (error as { response?: { data?: { message?: string; error?: string } } }).response?.data
      : undefined;
    throw new Error(message?.message || message?.error || '관리자 통계를 불러오지 못했습니다.');
  }
}
