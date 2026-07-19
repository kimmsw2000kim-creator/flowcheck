import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

export interface CurrentUser {
  id: string;
  email: string;
  avatarUrl: string;
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
  startSession: (user: { id: string; email: string }) => void;
  finishSession: (userId: string, user?: Partial<CurrentUser>) => void;
  resetAuthState: () => void;
  updateUserBalanceAndCoupons: (updated: {
    balance: number;
    coupons: number;
    loadTestCoupons?: number;
    UIUXTestCoupons?: number;
  }) => void;
  loginSuccess: (email: string, token?: string, userId?: string) => void;
  logout: () => Promise<void>;
}

const createInitialUser = (): CurrentUser => ({
  id: '',
  email: '',
  avatarUrl: '',
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
  startSession: (user) =>
    set((state) => {
      const isSameUser = state.currentUser.id === user.id;
      return {
        currentUser: isSameUser
          ? { ...state.currentUser, email: user.email }
          : { ...createInitialUser(), id: user.id, email: user.email },
        authStatus:
          isSameUser && state.authStatus === 'authenticated'
            ? 'authenticated'
            : 'checking',
      };
    }),
  finishSession: (userId, user = {}) =>
    set((state) => {
      if (state.currentUser.id !== userId) return state;
      return {
        currentUser: { ...state.currentUser, ...user, id: userId },
        authStatus: 'authenticated',
      };
    }),
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
  loginSuccess: (email, _token, userId) => {
    set((state) => ({
      currentUser:
        userId && userId !== state.currentUser.id
          ? { ...createInitialUser(), id: userId, email }
          : { ...state.currentUser, id: userId ?? state.currentUser.id, email },
      authStatus:
        userId === state.currentUser.id && state.authStatus === 'authenticated'
          ? 'authenticated'
          : 'checking',
    }));
  },
  logout: async () => {
    clearLegacyAuthStorage();
    set(anonymousAuthState());

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Failed to sign out from Supabase:', error);
    }
  },
}));
