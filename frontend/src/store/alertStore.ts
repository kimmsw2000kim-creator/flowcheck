import { create } from 'zustand';
import { localizeErrorMessage } from '../utils/errorMessage';

export interface AlertMsg {
  message: string;
  type: string;
}

interface AlertState {
  alertMsg: AlertMsg | null;
  showAlert: (message: string, type?: string) => void;
}

let activeTimeoutId: ReturnType<typeof setTimeout> | null = null;

export const useAlertStore = create<AlertState>((set) => ({
  alertMsg: null,
  showAlert: (message, type = 'success') => {
    if (activeTimeoutId) {
      clearTimeout(activeTimeoutId);
    }
    const displayMessage = type === 'error'
      ? localizeErrorMessage(message, '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
      : message;
    set({ alertMsg: { message: displayMessage, type } });
    activeTimeoutId = setTimeout(() => {
      set({ alertMsg: null });
      activeTimeoutId = null;
    }, 5000);
  },
}));
