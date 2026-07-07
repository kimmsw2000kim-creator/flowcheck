import axios from 'axios';
import type { Domain } from '../types/domain';

export async function fetchDomains(accessToken: string): Promise<Domain[]> {
  try {
    const response = await axios.get<Domain[]>('/api/sites', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      '도메인 목록을 불러오지 못했습니다.';
    throw new Error(message);
  }
}

export async function registerDomain(accessToken: string, domainUrl: string): Promise<Domain> {
  try {
    const response = await axios.post<Domain>(
      '/api/sites',
      { domainUrl },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
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

export async function verifyDomain(accessToken: string, id: number): Promise<Domain> {
  try {
    const response = await axios.post<Domain>(
      `/api/sites/${id}/verify`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
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
