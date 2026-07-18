import type { MypageData, MypagePointHistoryItem, MypageTestHistoryItem, MypageCouponHistoryItem } from '../types/mypage';
import type { UIUXTestStatusResponse } from './UIUXTestApi';
import type { AxiosRequestConfig } from 'axios';
import apiClient, { getAccountAccessMessage } from './client';

export async function fetchMypage(config?: AxiosRequestConfig): Promise<MypageData> {
    try {
        const response = await apiClient.get<MypageData>('/api/mypage', config);
        return response.data;
    } catch (error: any) {
        if (getAccountAccessMessage(error)) throw error;
        const message =
            error.response?.data?.message ||
            error.response?.data?.error ||
            '마이페이지 정보를 불러오지 못했습니다.';
        throw new Error(message);
    }
}

export async function fetchMypageTestHistory(): Promise<MypageTestHistoryItem[]> {
    try {
        const response = await apiClient.get<MypageTestHistoryItem[]>('/api/mypage/tests');
        return response.data;
    } catch (error: any) {
        const message =
            error.response?.data?.message ||
            error.response?.data?.error ||
            '테스트 이력을 불러오지 못했습니다.';
        throw new Error(message);
    }
}

export async function fetchMypageUIUXTestDetail(requestId: string): Promise<UIUXTestStatusResponse> {
    try {
        const response = await apiClient.get<UIUXTestStatusResponse>(`/api/mypage/tests/uiux/${requestId}`);
        return response.data;
    } catch (error: any) {
        const message =
            error.response?.data?.message ||
            error.response?.data?.error ||
            'UI/UX 테스트 결과를 불러오지 못했습니다.';
        throw new Error(message);
    }
}

export async function fetchMypagePointHistory(): Promise<MypagePointHistoryItem[]> {
    const response = await apiClient.get<MypagePointHistoryItem[]>('/api/mypage/points/history');
    return response.data;
}

export async function fetchMypageCouponHistory(): Promise<MypageCouponHistoryItem[]> {
    const response = await apiClient.get<MypageCouponHistoryItem[]>('/api/mypage/coupons/history');
    return response.data;
}
