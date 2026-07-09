import { create } from 'zustand';
import { useAlertStore } from './alertStore';

export interface CurrentUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN' | string;
  balance: number;
  status: string;
  coupons: number;
  loadTestCoupons: number;
  uiUxTestCoupons: number;
}

interface UserState {
  currentUser: CurrentUser;
  setCurrentUser: (user: Partial<CurrentUser>) => void;
  updateUserBalanceAndCoupons: (updated: {
    balance: number;
    coupons: number;
    loadTestCoupons?: number;
    uiUxTestCoupons?: number;
  }) => void;
  loginSuccess: (email: string, token?: string, userId?: string) => void;
  logout: () => void;
  toggleRole: () => void;
}

const initialUser: CurrentUser = {
  id: '',
  email: '',
  role: 'USER',
  balance: 0,
  status: 'ACTIVE',
  coupons: 0,
  loadTestCoupons: 0,
  uiUxTestCoupons: 0,
};

export const useUserStore = create<UserState>((set) => ({
  currentUser: {
    ...initialUser,
    id: typeof window !== 'undefined' ? localStorage.getItem('userId') ?? '' : '',
    email: typeof window !== 'undefined' ? localStorage.getItem('email') ?? '' : '',
  },
  setCurrentUser: (user) =>
    set((state) => ({
      currentUser: { ...state.currentUser, ...user },
    })),
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
        uiUxTestCoupons:
          updated.uiUxTestCoupons !== undefined
            ? updated.uiUxTestCoupons
            : state.currentUser.uiUxTestCoupons,
      },
    })),
  loginSuccess: (email, token, userId) => {
    if (email) localStorage.setItem('email', email);
    if (userId) localStorage.setItem('userId', userId);
    set((state) => ({
      currentUser: {
        ...state.currentUser,
        id: userId ?? state.currentUser.id,
        email,
      },
    }));
  },
  logout: () => {
    localStorage.clear();
    set({ currentUser: { ...initialUser } });
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
