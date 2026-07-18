import axios from 'axios';
import ApiURL from './ApiURL';
import { supabase } from '../lib/supabaseClient';
import { useAlertStore } from '../store/alertStore';
import { useUserStore } from '../store/userStore';

const accountAccessCodes = new Set([
  'ACCOUNT_INVALID',
  'ACCOUNT_NOT_FOUND',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_WITHDRAWN',
]);

let accountAccessHandling: Promise<void> | null = null;

export function getAccountAccessMessage(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null;

  const code = error.response?.data?.code;
  if (typeof code !== 'string' || !accountAccessCodes.has(code)) return null;

  const message = error.response?.data?.message;
  return typeof message === 'string' && message.trim()
    ? message
    : '현재 이용할 수 없는 계정입니다.';
}

const apiClient = axios.create({
  baseURL: ApiURL,
});

apiClient.interceptors.request.use(async (config) => {
  if (config.headers.Authorization) {
    return config;
  }

  const { data: { session } } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const accountAccessMessage = getAccountAccessMessage(error);
    if (accountAccessMessage) {
      if (!accountAccessHandling) {
        accountAccessHandling = (async () => {
          await useUserStore.getState().logout();
          useAlertStore.getState().showAlert(accountAccessMessage, 'error');

          if (window.location.pathname !== '/login') {
            sessionStorage.setItem('accountAccessMessage', accountAccessMessage);
            window.location.href = '/login';
          }
        })().finally(() => {
          accountAccessHandling = null;
        });
      }

      await accountAccessHandling;
      return Promise.reject(error);
    }

    if (error.response && error.response.status === 401) {
      await useUserStore.getState().logout();

      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
