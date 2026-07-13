import { create } from 'zustand';
import { useAlertStore } from './alertStore';
import { supabase } from '../lib/supabaseClient';

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

export interface CurrentUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN' | string;
  balance: number;
  status: string;
  coupons: number;
  loadTestCoupons: number;
  UIUXTestCoupons: number;
}

interface UserState {
  currentUser: CurrentUser;
  authStatus: AuthStatus;
  setAuthStatus: (status: AuthStatus) => void;
  setCurrentUser: (user: Partial<CurrentUser>) => void;
  resetAuthState: () => void;
  updateUserBalanceAndCoupons: (updated: {
    balance: number;
    coupons: number;
    loadTestCoupons?: number;
    UIUXTestCoupons?: number;
  }) => void;
  loginSuccess: (email: string, token?: string, userId?: string) => void;
  logout: () => Promise<void>;
  toggleRole: () => void;
}

const createInitialUser = (): CurrentUser => ({
  id: '',
  email: '',
  role: 'USER',
  balance: 0,
  status: 'ACTIVE',
  coupons: 0,
  loadTestCoupons: 0,
  UIUXTestCoupons: 0,
});

const clearLegacyAuthStorage = () => {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('email');
  localStorage.removeItem('userId');
};

const anonymousAuthState = () => ({
  currentUser: createInitialUser(),
  authStatus: 'anonymous' as const,
});

export const useUserStore = create<UserState>((set) => ({
  currentUser: createInitialUser(),
  authStatus: 'checking',
  setAuthStatus: (authStatus) => set({ authStatus }),
  setCurrentUser: (user) =>
    set((state) => ({
      currentUser: { ...state.currentUser, ...user },
    })),
  resetAuthState: () => {
    clearLegacyAuthStorage();
    set(anonymousAuthState());
  },
  updateUserBalanceAndCoupons: (updated) =>
    set((state) => ({
      currentUser: {
        ...state.currentUser,
        balance: updated.balance,
        coupons: updated.coupons,
        loadTestCoupons:
          updated.loadTestCoupons !== undefined
            ? updated.loadTestCoupons
            : state.currentUser.loadTestCoupons,
        UIUXTestCoupons:
          updated.UIUXTestCoupons !== undefined
            ? updated.UIUXTestCoupons
            : state.currentUser.UIUXTestCoupons,
      },
    })),
  loginSuccess: (email, token, userId) => {
    set((state) => ({
      currentUser: {
        ...state.currentUser,
        id: userId ?? state.currentUser.id,
        email,
      },
      authStatus: 'authenticated',
    }));
  },
  logout: async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Failed to sign out from Supabase:', error);
    } finally {
      clearLegacyAuthStorage();
      set(anonymousAuthState());
    }
  },
  toggleRole: () =>
    set((state) => {
      const nextRole = state.currentUser.role === 'USER' ? 'ADMIN' : 'USER';

      // Call showAlert directly from alertStore
      useAlertStore.getState().showAlert(
        `시뮬레이션 역할을 ${nextRole === 'ADMIN' ? '관리자' : '일반 사용자'}(으)로 전환했습니다.`,
        'info'
      );

      return {
        currentUser: { ...state.currentUser, role: nextRole },
      };
    }),
}));
