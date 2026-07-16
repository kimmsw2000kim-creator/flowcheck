import axios from 'axios';

import apiClient from './client';
import type {
    CreatePostRequest,
    Post,
    PostCategory,
    PostPage,
    UpdatePostRequest,
} from '../types/post';



/*
 * 커뮤니티 게시글 목록 조회에 사용하는 조건입니다.
 */
interface FetchCommunityPostsParams {
    category: PostCategory;
    keyword?: string;
    page?: number;
    size?: number;
    sort?: string;
}

/*
 * Axios 오류에서 백엔드가 전달한 오류 메시지를 추출합니다.
 */
function getErrorMessage(
    error: unknown,
    fallbackMessage: string
): string {
    if (axios.isAxiosError(error)) {
        const responseData = error.response?.data as
            | {
                message?: string;
                error?: string;

                // ResponseStatusException의 오류 내용입니다.
                detail?: string;
            }
            | undefined;

        return (
            responseData?.message ||
            responseData?.detail ||
            responseData?.error ||
            fallbackMessage
        );
    }

    return fallbackMessage;
}

/*
 * 카테고리별 커뮤니티 게시글을 조회합니다.
 *
 * 기본값은 첫 페이지, 10개, 최신순입니다.
 */
export async function fetchCommunityPosts({
    category,
    keyword,
    page = 0,
    size = 10,
    sort = 'createdAt,desc',
}: FetchCommunityPostsParams): Promise<PostPage> {
    try {
        const response = await apiClient.get<PostPage>(
            '/api/community/posts',
            {
                params: {
                    category,
                    keyword: keyword || undefined,
                    page,
                    size,
                    sort,
                },
            }
        );

        return response.data;
    } catch (error: unknown) {
        throw new Error(
            getErrorMessage(
                error,
                '커뮤니티 게시글을 불러오지 못했습니다.'
            )
        );
    }
}

/*
 * 게시글 한 건의 상세 내용을 조회합니다.
 */
export async function fetchCommunityPost(
    postId: number
): Promise<Post> {
    try {
        const response = await apiClient.get<Post>(
            `/api/community/posts/${postId}`
        );

        return response.data;
    } catch (error: unknown) {
        throw new Error(
            getErrorMessage(
                error,
                '커뮤니티 게시글을 불러오지 못했습니다.'
            )
        );
    }
}

/*
 * 로그인한 사용자의 새 커뮤니티 게시글을 생성합니다.
 *
 * 인증 토큰은 공통 apiClient가 자동으로 추가합니다.
 */
export async function createCommunityPost(
    request: CreatePostRequest
): Promise<Post> {
    try {
        const response = await apiClient.post<Post>(
            '/api/community/posts',
            request
        );

        return response.data;
    } catch (error: unknown) {
        throw new Error(
            getErrorMessage(
                error,
                '커뮤니티 게시글을 작성하지 못했습니다.'
            )
        );
    }
}

/*
 * 로그인한 사용자가 본인의 커뮤니티 게시글을 수정합니다.
 *
 * 카테고리와 연결 정보는 변경하지 않고
 * 제목과 내용만 전송합니다.
 */
export async function updateCommunityPost(
    postId: number,
    request: UpdatePostRequest
): Promise<Post> {
    try {
        const response = await apiClient.put<Post>(
            `/api/community/posts/${postId}`,
            request
        );

        return response.data;
    } catch (error: unknown) {
        throw new Error(
            getErrorMessage(
                error,
                '커뮤니티 게시글을 수정하지 못했습니다.'
            )
        );
    }
}

/*
 * 로그인한 사용자가 본인의 커뮤니티 게시글을 삭제합니다.
 *
 * 삭제 성공 시 백엔드는 204 No Content를 반환합니다.
 */
export async function deleteCommunityPost(
    postId: number
): Promise<void> {
    try {
        await apiClient.delete(
            `/api/community/posts/${postId}`
        );
    } catch (error: unknown) {
        throw new Error(
            getErrorMessage(
                error,
                '커뮤니티 게시글을 삭제하지 못했습니다.'
            )
        );
    }
}