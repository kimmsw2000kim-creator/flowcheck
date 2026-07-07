import axios from 'axios';
import type { MypageData, MypageTestHistoryItem } from '../types/mypage';

export async function fetchMypage(accessToken: string): Promise<MypageData> {
    try {
        const response = await axios.get<MypageData>('/api/mypage', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        return response.data;
    } catch (error: any) {
        const message =
            error.response?.data?.message ||
            error.response?.data?.error ||
            '마이페이지 정보를 불러오지 못했습니다.';

        throw new Error(message);
    }
}

export async function fetchMypageTestHistory(accessToken: string): Promise<MypageTestHistoryItem[]> {
    try {
        const response = await axios.get<MypageTestHistoryItem[]>('/api/mypage/tests', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        return response.data;
    } catch (error: any) {
        const message =
            error.response?.data?.message ||
            error.response?.data?.error ||
            '테스트 이력을 불러오지 못했습니다.';

        throw new Error(message);
    }
}
