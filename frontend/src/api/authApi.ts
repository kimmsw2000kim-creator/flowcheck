import type { Session } from '@supabase/supabase-js';
import apiClient, { getAccountAccessCode, getAccountAccessMessage } from './client';
import { supabase } from "../lib/supabaseClient";
import { useUserStore } from "../store/userStore";

export interface AuthParams {
    email: string;
    password?: string;
    nickname?: string;
}

export async function requestPasswordReset(email: string): Promise<void> {
    // Supabase 대시보드의 Redirect URLs에도 이 경로가 정확히 등록되어 있어야 합니다.
    const redirectTo = new URL('/reset-password', window.location.origin).toString();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
    });

    if (error) throw new Error(error.message);
}

export async function updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
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

    // 이메일 인증이 켜진 Supabase는 기존 확정 계정에 오류 대신
    // identities가 비어 있는 가짜 사용자 객체를 반환합니다.
    // FlowCheck 정책상 가입 여부를 명확히 안내하기 위해 이를 기존 계정으로 판정합니다.
    if (data.user?.identities?.length === 0) {
        throw new Error("이미 가입된 계정입니다. 로그인하거나 비밀번호 찾기를 이용해 주세요.");
    }

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

export async function reactivateAccount(session: Session): Promise<Session> {
    await apiClient.post('/api/mypage/account/reactivate', undefined, {
        headers: { Authorization: `Bearer ${session.access_token}` },
    });

    // 재활성화는 백엔드 DB 상태만 바꾸므로 기존 Supabase 토큰은 그대로입니다.
    // 토큰을 명시적으로 갱신해 세션 부트스트랩이 ACTIVE 계정을 다시 조회하게 합니다.
    const { data, error } = await supabase.auth.refreshSession({
        refresh_token: session.refresh_token,
    });

    if (error || !data.session) {
        throw new Error(error?.message ?? '재활성화된 로그인 세션을 갱신하지 못했습니다.');
    }

    await validateActiveSession(data.session);
    return data.session;
}

export async function logout(): Promise<void> {
    await useUserStore.getState().logout();
}
