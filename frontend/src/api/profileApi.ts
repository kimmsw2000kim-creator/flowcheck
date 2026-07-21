import type { UserMetadata } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { getKoreanErrorMessage } from '../utils/errorMessage';
import apiClient from './client';

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const allowedAvatarTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

export function getProfileImageUrl(metadata?: UserMetadata | null): string {
  const value = metadata?.avatar_url;
  return typeof value === 'string' ? value : '';
}

export async function syncPublicProfileImage(avatarUrl: string | null): Promise<void> {
  // 공개 프로필 URL 동기화
  await apiClient.patch('/api/mypage/profile-image', { avatarUrl });
}

export async function uploadProfileImage(file: File): Promise<string> {
  // 파일 형식 검증
  const extension = allowedAvatarTypes.get(file.type);
  if (!extension) {
    throw new Error('JPG, PNG, WebP 또는 GIF 이미지만 업로드할 수 있습니다.');
  }
  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error('프로필 사진은 5MB 이하만 업로드할 수 있습니다.');
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('로그인 정보를 확인하지 못했습니다. 다시 로그인해 주세요.');
  }

  const previousPath = typeof user.user_metadata?.avatar_path === 'string'
    ? user.user_metadata.avatar_path
    : '';
  const previousAvatarUrl = getProfileImageUrl(user.user_metadata);
  const objectPath = `${user.id}/avatar-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(objectPath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) throw new Error(getKoreanErrorMessage(uploadError, '프로필 사진 업로드에 실패했습니다.'));

  const { data: publicUrlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath);
  const avatarUrl = publicUrlData.publicUrl;

  const { error: metadataError } = await supabase.auth.updateUser({
    data: { avatar_url: avatarUrl, avatar_path: objectPath },
  });

  if (metadataError) {
    await supabase.storage.from(AVATAR_BUCKET).remove([objectPath]);
    throw new Error(getKoreanErrorMessage(metadataError, '프로필 정보 저장에 실패했습니다.'));
  }

  try {
    await syncPublicProfileImage(avatarUrl);
  } catch {
    const { error: rollbackError } = await supabase.auth.updateUser({
      data: {
        avatar_url: previousAvatarUrl || null,
        avatar_path: previousPath || null,
      },
    });
    if (rollbackError) console.warn('Failed to restore profile metadata:', rollbackError);
    await supabase.storage.from(AVATAR_BUCKET).remove([objectPath]);
    throw new Error('공개 프로필 사진 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }

  if (previousPath && previousPath !== objectPath && previousPath.startsWith(`${user.id}/`)) {
    const { error: cleanupError } = await supabase.storage.from(AVATAR_BUCKET).remove([previousPath]);
    if (cleanupError) console.warn('Failed to remove previous profile image:', cleanupError);
  }

  return avatarUrl;
}

export async function removeProfileImage(): Promise<void> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('로그인 정보를 확인하지 못했습니다. 다시 로그인해 주세요.');
  }

  const previousPath = typeof user.user_metadata?.avatar_path === 'string'
    ? user.user_metadata.avatar_path
    : '';
  const previousAvatarUrl = getProfileImageUrl(user.user_metadata);

  const { error: metadataError } = await supabase.auth.updateUser({
    data: { avatar_url: null, avatar_path: null },
  });
  if (metadataError) throw new Error(getKoreanErrorMessage(metadataError, '프로필 사진 삭제에 실패했습니다.'));

  try {
    await syncPublicProfileImage(null);
  } catch {
    const { error: rollbackError } = await supabase.auth.updateUser({
      data: {
        avatar_url: previousAvatarUrl || null,
        avatar_path: previousPath || null,
      },
    });
    if (rollbackError) console.warn('Failed to restore profile metadata:', rollbackError);
    throw new Error('공개 프로필 사진 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }

  if (previousPath && previousPath.startsWith(`${user.id}/`)) {
    const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove([previousPath]);
    if (removeError) console.warn('Failed to remove profile image object:', removeError);
  }
}
