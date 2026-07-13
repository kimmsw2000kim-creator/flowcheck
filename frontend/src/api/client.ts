import axios from 'axios';
import ApiURL from './ApiURL';
import { supabase } from '../lib/supabaseClient';
import { useUserStore } from '../store/userStore';

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
