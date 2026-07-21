import apiClient from './client';
import { getKoreanErrorMessage } from '../utils/errorMessage';
import type {
    CreatePostRequest,
    CreatePostCommentRequest,
    CommunityPostLikeStatus,
    Post,
    PostComment,
    PostCommentPage,
    PostCategory,
    PostPage,
    UpdatePostRequest,
} from '../types/post';

import type {
    CommunitySharedTestResult,
} from '../types/communityTestResult';


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
    return getKoreanErrorMessage(error, fallbackMessage);
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

/*
 * 테스트 공유 게시글과 연결된 실제 테스트 결과를 조회합니다.
 *
 * requestId를 직접 사용하지 않고 게시글 번호를 기준으로 조회합니다.
 */
export async function fetchCommunityTestResult(
    postId: number
): Promise<CommunitySharedTestResult> {
    try {
        const response =
            await apiClient.get<CommunitySharedTestResult>(
                `/api/community/posts/${postId}/test-result`
            );

        return response.data;
    } catch (error: unknown) {
        throw new Error(
            getErrorMessage(
                error,
                '공유된 테스트 결과를 불러오지 못했습니다.'
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

export async function fetchCommunityPostLikeStatus(
    postId: number
): Promise<CommunityPostLikeStatus> {
    try {
        const response = await apiClient.get<CommunityPostLikeStatus>(
            `/api/community/posts/${postId}/like-status`
        );
        return response.data;
    } catch (error: unknown) {
        throw new Error(getErrorMessage(error, '좋아요 상태를 불러오지 못했습니다.'));
    }
}

export async function toggleCommunityPostLike(
    postId: number
): Promise<CommunityPostLikeStatus> {
    try {
        const response = await apiClient.post<CommunityPostLikeStatus>(
            `/api/community/posts/${postId}/like`
        );
        return response.data;
    } catch (error: unknown) {
        throw new Error(getErrorMessage(error, '좋아요 처리에 실패했습니다.'));
    }
}

export async function fetchCommunityPostComments(
    postId: number,
    page = 0,
    size = 20
): Promise<PostCommentPage> {
    try {
        const response = await apiClient.get<PostCommentPage>(
            `/api/community/posts/${postId}/comments`,
            { params: { page, size } }
        );
        return response.data;
    } catch (error: unknown) {
        throw new Error(getErrorMessage(error, '댓글을 불러오지 못했습니다.'));
    }
}

export async function createCommunityPostComment(
    postId: number,
    request: CreatePostCommentRequest
): Promise<PostComment> {
    try {
        const response = await apiClient.post<PostComment>(
            `/api/community/posts/${postId}/comments`,
            request
        );
        return response.data;
    } catch (error: unknown) {
        throw new Error(getErrorMessage(error, '댓글 작성에 실패했습니다.'));
    }
}

export async function deleteCommunityPostComment(commentId: number): Promise<void> {
    try {
        await apiClient.delete(`/api/community/posts/comments/${commentId}`);
    } catch (error: unknown) {
        throw new Error(getErrorMessage(error, '댓글 삭제에 실패했습니다.'));
    }
}
