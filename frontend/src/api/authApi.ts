import type { Session } from '@supabase/supabase-js';
import apiClient, { getAccountAccessCode, getAccountAccessMessage } from './client';
import { supabase } from "../lib/supabaseClient";
import { useUserStore } from "../store/userStore";

export interface AuthParams {
    email: string;
    password?: string;
    nickname?: string;
}

export async function signup({ email, password, nickname }: AuthParams): Promise<any> {
    if (!password) throw new Error("비밀번호가 필요합니다.");

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                nickname
            },
        },
    });

    if (error) throw new Error(error.message);
    return data;
}

export async function login({ email, password }: AuthParams): Promise<any> {
    if (!password) throw new Error("비밀번호가 필요합니다.");

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) throw new Error(error.message);

    if (data.session) {
        await validateActiveSession(data.session);
    }

    return data;
}

export class AccountDeactivatedError extends Error {
    constructor(message: string, public readonly session: Session) {
        super(message);
        this.name = 'AccountDeactivatedError';
    }
}

export async function validateActiveSession(session: Session): Promise<void> {
    try {
        const response = await apiClient.get('/api/mypage', {
            headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.data?.status && response.data.status !== 'ACTIVE') {
            throw new Error('현재 이용할 수 없는 계정입니다.');
        }
    } catch (error) {
        if (getAccountAccessCode(error) === 'ACCOUNT_DEACTIVATED') {
            // 재활성화 확인에 현재 Supabase 세션을 그대로 사용합니다.
            throw new AccountDeactivatedError(
                getAccountAccessMessage(error) ?? '비활성화된 계정입니다.',
                session,
            );
        }

        await supabase.auth.signOut();
        const message = getAccountAccessMessage(error)
            ?? (error instanceof Error ? error.message : null)
            ?? '계정 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
        throw new Error(message);
    }
}

export async function reactivateAccount(session: Session): Promise<void> {
    await apiClient.post('/api/mypage/account/reactivate', undefined, {
        headers: { Authorization: `Bearer ${session.access_token}` },
    });
    await validateActiveSession(session);
}

export async function logout(): Promise<void> {
    await useUserStore.getState().logout();
}
