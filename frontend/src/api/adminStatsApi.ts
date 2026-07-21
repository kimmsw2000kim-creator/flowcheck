import apiClient from './client';
import type { AdminStats } from '../types/adminStats';
import { getKoreanErrorMessage } from '../utils/errorMessage';

export async function fetchAdminStats(): Promise<AdminStats> {
  try {
    const response = await apiClient.get<AdminStats>('/api/admin/stats');
    return response.data;
  } catch (error) {
    throw new Error(getKoreanErrorMessage(error, '관리자 통계를 불러오지 못했습니다.'));
  }
}
