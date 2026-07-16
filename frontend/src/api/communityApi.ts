import ApiURL from './ApiURL';
import type {
  ForumComment,
  ForumCommentPage,
  ForumLikeStatus,
  ForumPost,
  ForumPostPage,
} from '../types/community';

const API_BASE_URL = ApiURL;

function getToken() {
  return localStorage.getItem('accessToken');
}

function authHeaders() {
  const token = getToken();

  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

function unwrap<T>(value: T | { data: T }): T {
  if (value && typeof value === 'object' && 'data' in value) {
    return value.data;
  }

  return value as T;
}

async function parseError(response: Response, fallback: string) {
  const message = await response.text().catch(() => '');
  return message || fallback;
}

export async function getPosts(
  page = 0,
  size = 10,
  keyword = '',
): Promise<ForumPost[] | ForumPostPage> {
  const url = keyword.trim()
    ? `${API_BASE_URL}/api/posts?page=${page}&size=${size}&keyword=${encodeURIComponent(keyword)}`
    : `${API_BASE_URL}/api/posts?page=${page}&size=${size}`;
  const response = await fetch(url, { method: 'GET', headers: authHeaders() });

  if (!response.ok) {
    throw new Error('게시글 목록을 불러오지 못했습니다.');
  }

  return unwrap(await response.json());
}

export async function getPost(postId: number): Promise<ForumPost> {
  const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('게시글을 불러오지 못했습니다.');
  }

  return unwrap(await response.json());
}

export async function createPost({
  title,
  content,
  promoUrl,
}: {
  title: string;
  content: string;
  promoUrl?: string;
}): Promise<ForumPost> {
  const response = await fetch(`${API_BASE_URL}/api/posts`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title, content, promoUrl }),
  });

  if (!response.ok) {
    throw new Error('게시글 작성에 실패했습니다.');
  }

  return unwrap(await response.json());
}

export async function updatePost(
  postId: number,
  data: { title: string; content: string },
): Promise<ForumPost> {
  const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, `게시글 수정에 실패했습니다. (${response.status})`));
  }

  return unwrap(await response.json());
}

export async function deleteComment(commentId: number) {
  const response = await fetch(`${API_BASE_URL}/api/posts/comments/${commentId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, `댓글 삭제에 실패했습니다. (${response.status})`));
  }
}

export async function likePost(postId: number): Promise<ForumLikeStatus> {
  const email = localStorage.getItem('email');

  if (!email) {
    throw new Error('로그인한 사용자 정보를 찾을 수 없습니다.');
  }

  const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/like`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email }),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || '좋아요 처리에 실패했습니다.');
  }

  return unwrap(data);
}

export async function getLikeStatus(postId: number): Promise<ForumLikeStatus> {
  const email = localStorage.getItem('email');

  if (!email) {
    return { postId, likeCount: 0, liked: false, message: '로그인 정보가 없습니다.' };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/posts/${postId}/like-status?email=${encodeURIComponent(email)}`,
    { method: 'GET', headers: authHeaders() },
  );

  if (!response.ok) {
    throw new Error('좋아요 상태를 불러오지 못했습니다.');
  }

  return unwrap(await response.json());
}

export async function getComments(postId: number): Promise<ForumComment[]> {
  const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/comments`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('댓글을 불러오지 못했습니다.');
  }

  return unwrap(await response.json());
}

export async function getCommentPage(
  postId: number,
  page = 0,
  size = 20,
): Promise<ForumCommentPage> {
  const response = await fetch(
    `${API_BASE_URL}/api/posts/${postId}/comments/page?page=${page}&size=${size}`,
    {
      method: 'GET',
      headers: authHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error('댓글을 불러오지 못했습니다.');
  }

  return unwrap(await response.json());
}

export async function createComment(
  postId: number,
  data: { content: string; parentId: number | null },
): Promise<ForumComment> {
  const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ ...data, email: localStorage.getItem('email') }),
  });

  if (!response.ok) {
    throw new Error('댓글 작성에 실패했습니다.');
  }

  return unwrap(await response.json());
}

export async function deletePost(postId: number) {
  const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, `게시글 삭제에 실패했습니다. (${response.status})`));
  }
}
