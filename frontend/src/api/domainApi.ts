import type { Domain } from '../types/domain';
import apiClient from './client';

export async function fetchDomains(): Promise<Domain[]> {
  try {
    const response = await apiClient.get<Domain[]>('/api/sites');
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      '도메인 목록을 불러오지 못했습니다.';
    throw new Error(message);
  }
}

export async function registerDomain(domainUrl: string): Promise<Domain> {
  try {
    const response = await apiClient.post<Domain>(
      '/api/sites',
      { domainUrl }
    );
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      '도메인 등록에 실패했습니다.';
    throw new Error(message);
  }
}

export async function verifyDomain(id: number): Promise<Domain> {
  try {
    const response = await apiClient.post<Domain>(
      `/api/sites/${id}/verify`,
      {}
    );
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      '도메인 소유권 검증에 실패했습니다. 메타 태그 또는 텍스트 파일을 확인해 주세요.';
    throw new Error(message);
  }
}

export async function deleteDomain(id: number): Promise<void> {
  try {
    await apiClient.delete(`/api/sites/${id}`);
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      '도메인 삭제에 실패했습니다.';
    throw new Error(message);
  }
}
