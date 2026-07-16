export interface ForumPost {
  id: number;
  title: string;
  content: string;
  promoUrl?: string;
  userId?: string;
  email?: string;
  writerEmail?: string;
  likes?: number;
  likeCount?: number;
  shares?: number;
  createdAt: string;
  commentCount?: number;
}

export interface ForumComment {
  id: number;
  postId?: number;
  userId?: string;
  author?: string;
  writerEmail?: string;
  content: string;
  parentId: number | null;
  createdAt: string;
  replies?: ForumComment[];
}

export interface ForumCommentPage {
  content: ForumComment[];
  totalElements?: number;
  totalPages: number;
  number?: number;
  size?: number;
}

export interface ForumPostPage {
  content: ForumPost[];
  totalElements?: number;
  totalPages: number;
  number?: number;
  size?: number;
}

export interface ForumLikeStatus {
  postId: number;
  likeCount: number;
  liked: boolean;
  message: string;
}
