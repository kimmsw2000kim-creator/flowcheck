export type PostCategory =
    | 'TEST_SHARE'
    | 'SITE_PROMOTION'
    | 'FREE_BOARD';

export interface Post {
    id: number;
    category: PostCategory;
    title: string;
    content: string;
    writerEmail: string;

    // 사이트 홍보 게시글에서 이동할 실제 주소입니다.
    promoUrl: string | null;

    createdAt: string;
    updatedAt: string;
    likeCount: number;
    commentCount: number;

    // 카테고리에 따라 연결 정보가 없으면 null로 전달됩니다.
    siteId: number | null;
    testRequestId: string | null;
}

export interface PostComment {
    id: number;
    content: string;
    writerEmail: string;
    createdAt: string;
    parentId: number | null;
    replies: PostComment[];
}

export interface PostPage {
    content: Post[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
}

export interface CreatePostRequest {
    category: PostCategory;
    title: string;
    content: string;
    siteId?: number;
    testRequestId?: string;
}

export interface UpdatePostRequest {
    title: string;
    content: string;
}