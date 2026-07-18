export type PostCategory = 'TEST_SHARE' | 'SITE_PROMOTION' | 'FREE_BOARD';

export interface Post {
  id: number;
  category: PostCategory;
  title: string;
  content: string;
  writerEmail: string;
  writerAvatarUrl: string | null;
  promoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  commentCount: number;
  siteId: number | null;
  testRequestId: string | null;
}

export interface PostComment {
  id: number;
  content: string;
  writerEmail: string;
  writerAvatarUrl: string | null;
  createdAt: string;
  parentId: number | null;
  replies: PostComment[];
}

export interface PostCommentPage {
  content: PostComment[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface CommunityPostLikeStatus {
  postId: number;
  likeCount: number;
  liked: boolean;
  message: string;
}

export interface CreatePostCommentRequest {
  content: string;
  parentId?: number | null;
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
