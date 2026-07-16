import { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { fetchMypage } from '../api/mypageApi';
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
    let lastSessionToken: string | null | undefined;
    let activeController: AbortController | null = null;

    const applySession = async (session: Session | null) => {
      if (disposed) return;

      const sessionToken = session?.access_token ?? null;
      if (lastSessionToken === sessionToken) return;
      lastSessionToken = sessionToken;

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
        lastSessionToken !== session.access_token ||
        useUserStore.getState().currentUser.id !== userId
      ) {
        return;
      }

      if (profileResult.status === 'fulfilled') {
        const profile = profileResult.value;
        finishSession(userId, {
          email: profile.email ?? email,
          role,
          status: profile.status ?? 'ACTIVE',
          balance: profile.balance,
          coupons: profile.couponCount,
          loadTestCoupons: profile.loadTestCouponCount,
          UIUXTestCoupons: profile.UIUXTestCouponCount,
        });
      } else {
        console.error('Failed to hydrate user profile:', profileResult.reason);
        // 프로필 조회가 실패해도 검증된 Supabase 역할은 유지합니다.
        finishSession(userId, { role });
        showAlert('사용자 정보를 불러오지 못했습니다. 기본 상태로 계속합니다.', 'warning');
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
