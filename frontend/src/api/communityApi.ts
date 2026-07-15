import ApiURL from './ApiURL';

const API_BASE_URL = ApiURL;

function getToken() {
    return localStorage.getItem("accessToken");
}

function authHeaders() {
    const token = getToken();

    return {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
    };
}

export async function getPosts(
    page = 0,
    size = 10,
    keyword = ""
) {

    const url =
        keyword.trim() === ""
            ? `${API_BASE_URL}/api/posts?page=${page}&size=${size}`
            : `${API_BASE_URL}/api/posts?page=${page}&size=${size}&keyword=${encodeURIComponent(keyword)}`;

    const response = await fetch(url, {
        method: "GET",
        headers: authHeaders(),
    });

    if (!response.ok) {
        throw new Error("게시글 목록을 불러오지 못했습니다.");
    }

    return response.json();
}

export async function getPost(postId: number) {
    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
        method: "GET",
        headers: authHeaders(),
    });

    if (!response.ok) {
        throw new Error("게시글을 불러오지 못했습니다.");
    }

    return response.json();
}

export async function createPost({
    title,
    content,
    promoUrl,
}: {
    title: string;
    content: string;
    promoUrl?: string;
}) {
    const response = await fetch(`${API_BASE_URL}/api/posts`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
            title,
            content,
            promoUrl,
        }),
    });

    if (!response.ok) {
        throw new Error("게시글 작성에 실패했습니다.");
    }

    return response.json();
}

export async function updatePost(
    postId: number,
    data: {
        title: string;
        content: string;
    }
) {
    const response = await fetch(
        `${API_BASE_URL}/api/posts/${postId}`,
        {
            method: "PUT",
            headers: authHeaders(),
            body: JSON.stringify({
                title: data.title,
                content: data.content,
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");

        throw new Error(
            errorText ||
            `게시글 수정에 실패했습니다. (${response.status})`
        );
    }

    return response.json();
}

export async function deleteComment(commentId: number) {
    const response = await fetch(
        `${API_BASE_URL}/api/posts/comments/${commentId}`,
        {
            method: "DELETE",
            headers: authHeaders(),
        }
    );

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");

        throw new Error(
            errorText ||
            `댓글 삭제에 실패했습니다. (${response.status})`
        );
    }
}

export async function likePost(postId: number) {
    const email = localStorage.getItem("email");

    if (!email) {
        throw new Error("로그인한 사용자 정보를 찾을 수 없습니다.");
    }

    const response = await fetch(
        `${API_BASE_URL}/api/posts/${postId}/like`,
        {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ email }),
        }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(data?.message || "좋아요 처리에 실패했습니다.");
    }

    return data as {
        postId: number;
        likeCount: number;
        liked: boolean;
        message: string;
    };
}

export async function getLikeStatus(postId: number) {
    const email = localStorage.getItem("email");

    if (!email) {
        return {
            postId,
            likeCount: 0,
            liked: false,
            message: "로그인 정보가 없습니다.",
        };
    }

    const response = await fetch(
        `${API_BASE_URL}/api/posts/${postId}/like-status?email=${encodeURIComponent(email)}`,
        {
            method: "GET",
            headers: authHeaders(),
        }
    );

    if (!response.ok) {
        throw new Error("좋아요 상태를 불러오지 못했습니다.");
    }

    return response.json();
}

export async function getComments(postId: number) {
    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/comments`, {
        method: "GET",
        headers: authHeaders(),
    });

    if (!response.ok) {
        throw new Error("댓글을 불러오지 못했습니다.");
    }

    return response.json();
}

export async function createComment(
    postId: number,
    data: {
        content: string;
        parentId: number | null;
    }
) {
    const email = localStorage.getItem("email");

    const response = await fetch(
        `${API_BASE_URL}/api/posts/${postId}/comments`,
        {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
                content: data.content,
                parentId: data.parentId,
                email,
            }),
        }
    );

    if (!response.ok) {
        throw new Error("댓글 작성에 실패했습니다.");
    }

    return response.json();
}

export async function deletePost(postId: number) {
    const response = await fetch(
        `${API_BASE_URL}/api/posts/${postId}`,
        {
            method: "DELETE",
            headers: authHeaders(),
        }
    );

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");

        throw new Error(
            errorText ||
            `게시글 삭제에 실패했습니다. (${response.status})`
        );
    }
}
