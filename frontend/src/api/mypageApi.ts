import type { MypageData } from '../types/mypage';

export async function fetchMypage(accessToken: string): Promise<MypageData> {
    const response = await fetch('/api/mypage', {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error("마이페이지 정보를 불러오지 못했습니다.");
    }

    return response.json();
}