import type {
    MypageActivityFilter,
    MypageCommunityActivityPage,
    MypageCouponHistoryItem,
    MypageData,
    MypagePointHistoryItem,
    MypageTestHistoryItem,
} from '../types/mypage';
import type { UIUXTestStatusResponse } from './UIUXTestApi';
import type { AxiosRequestConfig } from 'axios';
import apiClient, { getAccountAccessMessage } from './client';
import { getKoreanErrorMessage } from '../utils/errorMessage';

export async function fetchMypage(config?: AxiosRequestConfig): Promise<MypageData> {
    try {
        const response = await apiClient.get<MypageData>('/api/mypage', config);
        return response.data;
    } catch (error: any) {
        if (getAccountAccessMessage(error)) throw error;
        throw new Error(getKoreanErrorMessage(error, '마이페이지 정보를 불러오지 못했습니다.'));
    }
}

export async function fetchMypageTestHistory(): Promise<MypageTestHistoryItem[]> {
    try {
        const response = await apiClient.get<MypageTestHistoryItem[]>('/api/mypage/tests');
        return response.data;
    } catch (error: any) {
        throw new Error(getKoreanErrorMessage(error, '테스트 이력을 불러오지 못했습니다.'));
    }
}

export async function fetchMypageUIUXTestDetail(requestId: string): Promise<UIUXTestStatusResponse> {
    try {
        const response = await apiClient.get<UIUXTestStatusResponse>(`/api/mypage/tests/uiux/${requestId}`);
        return response.data;
    } catch (error: any) {
        throw new Error(getKoreanErrorMessage(error, 'UI/UX 테스트 결과를 불러오지 못했습니다.'));
    }
}

export async function fetchMypagePointHistory(): Promise<MypagePointHistoryItem[]> {
    try {
        const response = await apiClient.get<MypagePointHistoryItem[]>('/api/mypage/points/history');
        return response.data;
    } catch (error) {
        throw new Error(getKoreanErrorMessage(error, '크레딧 내역을 불러오지 못했습니다.'));
    }
}

export async function fetchMypageCouponHistory(): Promise<MypageCouponHistoryItem[]> {
    try {
        const response = await apiClient.get<MypageCouponHistoryItem[]>('/api/mypage/coupons/history');
        return response.data;
    } catch (error) {
        throw new Error(getKoreanErrorMessage(error, '쿠폰 사용 내역을 불러오지 못했습니다.'));
    }
}

export async function fetchMypageCommunityActivities(
    type: MypageActivityFilter,
    page = 0,
    size = 10,
): Promise<MypageCommunityActivityPage> {
    try {
        const response = await apiClient.get<MypageCommunityActivityPage>('/api/mypage/community/activities', {
            params: { type, page, size },
        });
        return response.data;
    } catch (error) {
        throw new Error(getKoreanErrorMessage(error, '활동 내역을 불러오지 못했습니다.'));
    }
}

export async function deactivateMypageAccount(): Promise<void> {
    try {
        await apiClient.patch('/api/mypage/account/deactivate');
    } catch (error) {
        throw new Error(getKoreanErrorMessage(error, '계정을 비활성화하지 못했습니다.'));
    }
}

export async function updateMypageNickname(nickname: string): Promise<string> {
    try {
        const response = await apiClient.patch<{ nickname: string }>('/api/mypage/nickname', { nickname });
        return response.data.nickname;
    } catch (error: any) {
        throw new Error(getKoreanErrorMessage(error, '닉네임을 변경하지 못했습니다.'));
    }
}
