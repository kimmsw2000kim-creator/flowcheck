import { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { fetchMypage } from '../api/mypageApi';
import { getAccountAccessCode, getAccountAccessMessage } from '../api/client';
import { getProfileImageUrl, syncPublicProfileImage } from '../api/profileApi';
import { supabase } from '../lib/supabaseClient';
import { useAlertStore } from '../store/alertStore';
import { useLedgerStore } from '../store/ledgerStore';
import { useUserStore } from '../store/userStore';

function hasAdminRole(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasAdminRole);
  }

  if (typeof value !== 'string') {
    return false;
  }

  const normalizedRole = value.trim().toUpperCase();
  return normalizedRole === 'ADMIN' || normalizedRole === 'ROLE_ADMIN';
}

function getSupabaseRole(session: Session): 'ADMIN' | 'USER' {
  const appMetadata = session.user.app_metadata;

  // 사용자가 직접 바꿀 수 있는 user_metadata가 아니라
  // Supabase 관리자만 변경할 수 있는 app_metadata만 신뢰합니다.
  return hasAdminRole(appMetadata?.role) || hasAdminRole(appMetadata?.roles)
    ? 'ADMIN'
    : 'USER';
}

function persistSession(session: Session): void {
  localStorage.setItem('accessToken', session.access_token);
  localStorage.setItem('refreshToken', session.refresh_token);
  localStorage.setItem('email', session.user.email ?? '');
  localStorage.setItem('userId', session.user.id);
}

export function useSessionBootstrap(): void {
  const authStatus = useUserStore((state) => state.authStatus);
  const startSession = useUserStore((state) => state.startSession);
  const finishSession = useUserStore((state) => state.finishSession);
  const resetAuthState = useUserStore((state) => state.resetAuthState);
  const loadLedgerForSession = useLedgerStore((state) => state.loadForSession);
  const clearLedger = useLedgerStore((state) => state.clear);
  const showAlert = useAlertStore((state) => state.showAlert);

  useEffect(() => {
    let disposed = false;
    let generation = 0;
    let lastSessionFingerprint: string | null | undefined;
    let activeController: AbortController | null = null;

    const applySession = async (session: Session | null) => {
      if (disposed) return;

      const avatarUrl = getProfileImageUrl(session?.user.user_metadata);
      const sessionFingerprint = session ? `${session.access_token}:${avatarUrl}` : null;
      if (lastSessionFingerprint === sessionFingerprint) return;
      lastSessionFingerprint = sessionFingerprint;

      const currentGeneration = ++generation;
      activeController?.abort();
      activeController = null;

      if (!session) {
        clearLedger();
        resetAuthState();
        return;
      }

      const userId = session.user.id;
      const email = session.user.email ?? '';
      const metadataNickname = typeof session.user.user_metadata?.nickname === 'string'
        ? session.user.user_metadata.nickname
        : '';
      const role = getSupabaseRole(session);
      const previousUserId = useUserStore.getState().currentUser.id;

      if (previousUserId !== userId) {
        clearLedger();
      }

      startSession({ id: userId, email });
      persistSession(session);

      const controller = new AbortController();
      activeController = controller;
      const requestConfig = {
        headers: { Authorization: `Bearer ${session.access_token}` },
        signal: controller.signal,
      };

      const [profileResult] = await Promise.allSettled([
        fetchMypage(requestConfig),
        loadLedgerForSession(session, controller.signal),
      ]);

      if (
        disposed ||
        controller.signal.aborted ||
        generation !== currentGeneration ||
        lastSessionFingerprint !== sessionFingerprint ||
        useUserStore.getState().currentUser.id !== userId
      ) {
        return;
      }

      if (profileResult.status === 'fulfilled') {
        const profile = profileResult.value;

        if (profile.status && profile.status !== 'ACTIVE') {
          clearLedger();
          resetAuthState();
          await supabase.auth.signOut();
          showAlert('현재 이용할 수 없는 계정입니다.', 'error');
          return;
        }

        // 기존 인증 메타데이터를 공개 프로필로 1회 이전
        if (!profile.avatarUrl && avatarUrl) {
          try {
            await syncPublicProfileImage(avatarUrl);
          } catch (syncError) {
            console.warn('Failed to migrate profile image URL:', syncError);
          }
        }

        finishSession(userId, {
          email: profile.email ?? email,
          nickname: profile.nickname ?? metadataNickname,
          avatarUrl: profile.avatarUrl || avatarUrl,
          role: profile.role ?? role,
          status: profile.status ?? 'ACTIVE',
          balance: profile.balance,
          coupons: profile.couponCount,
          loadTestCoupons: profile.loadTestCouponCount,
          UIUXTestCoupons: profile.UIUXTestCouponCount,
        });
      } else {
        if (getAccountAccessCode(profileResult.reason) === 'ACCOUNT_DEACTIVATED') {
          // 로그인 직후 재활성화가 이어질 수 있으므로 동일 세션의 재처리를 허용합니다.
          // reactivateAccount의 토큰 갱신 이벤트가 오면 ACTIVE 프로필을 다시 불러옵니다.
          lastSessionFingerprint = undefined;
          clearLedger();
          resetAuthState();
          return;
        }

        if (getAccountAccessMessage(profileResult.reason)) {
          clearLedger();
          resetAuthState();
          return;
        }

        console.error('Failed to hydrate user profile:', profileResult.reason);
        clearLedger();
        resetAuthState();
        await supabase.auth.signOut();
        showAlert('계정 상태를 확인하지 못해 로그아웃되었습니다. 잠시 후 다시 시도해 주세요.', 'error');
      }
    };

    void supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (disposed) return;
      if (error) {
        console.error('Failed to check Supabase session:', error);
        void applySession(null);
        return;
      }
      void applySession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        void applySession(session);
      }, 0);
    });

    return () => {
      disposed = true;
      generation += 1;
      activeController?.abort();
      subscription.unsubscribe();
    };
  }, [clearLedger, finishSession, loadLedgerForSession, resetAuthState, showAlert, startSession]);

  useEffect(() => {
    if (authStatus === 'anonymous') {
      clearLedger();
    }
  }, [authStatus, clearLedger]);
}
