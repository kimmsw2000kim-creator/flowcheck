import { create } from 'zustand';
import type { Domain } from '../types/domain';
import { fetchDomains, registerDomain, verifyDomain, deleteDomain } from '../api/domainApi';
import { useUserStore } from './userStore';
import { useAlertStore } from './alertStore';

interface DomainState {
  domains: Domain[];
  newDomainUrl: string;
  verificationLoading: boolean;
  setNewDomainUrl: (url: string) => void;
  loadDomains: () => Promise<void>;
  handleAddDomain: (e: React.FormEvent) => Promise<void>;
  handleVerifyDomain: (id: number) => Promise<void>;
  handleDeleteDomain: (id: number) => Promise<void>;
}

export const useDomainStore = create<DomainState>((set, get) => ({
  domains: [],
  newDomainUrl: '',
  verificationLoading: false,
  setNewDomainUrl: (url) => set({ newDomainUrl: url }),
  loadDomains: async () => {
    const currentUserEmail = useUserStore.getState().currentUser.email;
    if (!currentUserEmail) {
      set({ domains: [] });
      return;
    }
    try {
      const data = await fetchDomains();
      set({ domains: data });
    } catch (err: any) {
      console.error("Failed to load domains:", err.message);
    }
  },
  handleAddDomain: async (e) => {
    e.preventDefault();
    const { newDomainUrl } = get();
    const currentUserEmail = useUserStore.getState().currentUser.email;
    const showAlert = useAlertStore.getState().showAlert;
    if (!newDomainUrl) return;
    if (!currentUserEmail) {
      showAlert('로그인이 필요합니다.', 'error');
      return;
    }
    try {
      const data = await registerDomain(newDomainUrl);
      set((state) => ({
        domains: [data, ...state.domains],
        newDomainUrl: '',
      }));
      showAlert('도메인이 등록되었습니다. 소유권 검증 토큰을 적용한 후 지금 검증하기를 클릭하세요.');
    } catch (err: any) {
      showAlert(err.message, 'error');
    }
  },
  handleVerifyDomain: async (id) => {
    const currentUserEmail = useUserStore.getState().currentUser.email;
    const showAlert = useAlertStore.getState().showAlert;
    if (!currentUserEmail) {
      showAlert('로그인이 필요합니다.', 'error');
      return;
    }
    set({ verificationLoading: true });
    try {
      await verifyDomain(id);
      set((state) => ({
        domains: state.domains.map((d) => d.id === id ? { ...d, verified: true } : d),
        verificationLoading: false,
      }));
      showAlert('도메인 소유권 검증이 완료되었습니다!');
    } catch (err: any) {
      set({ verificationLoading: false });
      showAlert(err.message, 'error');
    }
  },
  handleDeleteDomain: async (id) => {
    const currentUserEmail = useUserStore.getState().currentUser.email;
    const showAlert = useAlertStore.getState().showAlert;
    if (!window.confirm("정말로 이 도메인을 삭제하시겠습니까?")) return;
    if (!currentUserEmail) {
      showAlert('로그인이 필요합니다.', 'error');
      return;
    }
    try {
      await deleteDomain(id);
      set((state) => ({
        domains: state.domains.filter((d) => d.id !== id),
      }));
      showAlert('도메인이 정상적으로 삭제되었습니다.');
    } catch (err: any) {
      showAlert(err.message, 'error');
    }
  },
}));
