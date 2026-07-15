import axios from 'axios';
import apiClient from './client';
import type { CreatePostRequest, Post, PostCategory, PostPage } from '../types/post';

interface FetchCommunityPostsParams {
  category: PostCategory;
  keyword?: string;
  page?: number;
  size?: number;
  sort?: string;
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data as { message?: string; error?: string } | undefined;
    return responseData?.message || responseData?.error || fallbackMessage;
  }
  return fallbackMessage;
}

export async function fetchCommunityPosts({
  category,
  keyword,
  page = 0,
  size = 10,
  sort = 'createdAt,desc',
}: FetchCommunityPostsParams): Promise<PostPage> {
  try {
    const response = await apiClient.get<PostPage>('/api/community/posts', {
      params: { category, keyword: keyword || undefined, page, size, sort },
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, '커뮤니티 게시글을 불러오지 못했습니다.'));
  }
}

export async function fetchCommunityPost(postId: number): Promise<Post> {
  try {
    const response = await apiClient.get<Post>(`/api/community/posts/${postId}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, '커뮤니티 게시글을 불러오지 못했습니다.'));
  }
}

export async function createCommunityPost(request: CreatePostRequest): Promise<Post> {
  try {
    const response = await apiClient.post<Post>('/api/community/posts', request);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, '커뮤니티 게시글을 작성하지 못했습니다.'));
  }
}
