import { supabase } from '../lib/supabaseClient';
import { getKoreanErrorMessage } from '../utils/errorMessage';

export async function getSupabaseSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(getKoreanErrorMessage(error, '로그인 세션을 확인하지 못했습니다.'));
  }

  return data.session;
}

export async function getSupabaseAccessToken() {
  const session = await getSupabaseSession();
  return session?.access_token ?? null;
}

export async function getSupabaseUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user;
}
