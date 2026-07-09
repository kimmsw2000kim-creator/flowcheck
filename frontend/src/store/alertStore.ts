import { create } from 'zustand';

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
    set({ alertMsg: { message, type } });
    activeTimeoutId = setTimeout(() => {
      set({ alertMsg: null });
      activeTimeoutId = null;
    }, 5000);
  },
}));
