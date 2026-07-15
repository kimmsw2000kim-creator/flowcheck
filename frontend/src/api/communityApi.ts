<<<<<<< HEAD
const configuredApiUrl =
    import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");
=======
import ApiURL from './ApiURL';

const API_BASE_URL = ApiURL;
>>>>>>> dev

/**
 * 개발 환경
 *   http://localhost:8080/api
 *
 * 운영 환경
 *   /api
 *
 * 환경변수에 이미 /api가 있으면 중복해서 붙이지 않습니다.
 */
const API_ROOT = configuredApiUrl
    ? configuredApiUrl.endsWith("/api")
        ? configuredApiUrl
        : `${configuredApiUrl}/api`
    : import.meta.env.DEV
        ? "http://localhost:8080/api"
        : "/api";

function getToken(): string | null {
    return localStorage.getItem("accessToken");
}

function authHeaders(includeJsonContentType = false): Record<string, string> {
    const token = getToken();

    return {
        Accept: "application/json",
        ...(includeJsonContentType && {
            "Content-Type": "application/json",
        }),
        ...(token && {
            Authorization: `Bearer ${token}`,
        }),
    };
}

async function getErrorMessage(
    response: Response,
    defaultMessage: string
): Promise<string> {
    const responseText = await response.text().catch(() => "");

    if (!responseText) {
        return `${defaultMessage} (${response.status})`;
    }

    try {
        const data = JSON.parse(responseText);

        return (
            data.message ||
            data.error ||
            `${defaultMessage} (${response.status})`
        );
    } catch {
        return responseText;
    }
}

export async function getPosts(
    page = 0,
    size = 10,
    keyword = ""
) {
    const params = new URLSearchParams({
        page: String(page),
        size: String(size),
    });

    if (keyword.trim()) {
        params.set("keyword", keyword.trim());
    }

    const response = await fetch(
        `${API_ROOT}/posts?${params.toString()}`,
        {
            method: "GET",
            headers: authHeaders(),
        }
    );

    if (!response.ok) {
        throw new Error(
            await getErrorMessage(
                response,
                "게시글 목록을 불러오지 못했습니다."
            )
        );
    }

    return response.json();
}

export async function getPost(postId: number) {
    const response = await fetch(`${API_ROOT}/posts/${postId}`, {
        method: "GET",
        headers: authHeaders(),
    });

    if (!response.ok) {
        throw new Error(
            await getErrorMessage(
                response,
                "게시글을 불러오지 못했습니다."
            )
        );
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
    const email = localStorage.getItem("email");

    const response = await fetch(`${API_ROOT}/posts`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
            title,
            content,
            promoUrl,
            email,
        }),
    });

    if (!response.ok) {
        throw new Error(
            await getErrorMessage(
                response,
                "게시글 작성에 실패했습니다."
            )
        );
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
    const response = await fetch(`${API_ROOT}/posts/${postId}`, {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify({
            title: data.title,
            content: data.content,
        }),
    });

    if (!response.ok) {
        throw new Error(
            await getErrorMessage(
                response,
                "게시글 수정에 실패했습니다."
            )
        );
    }

    return response.json();
}

export async function deletePost(postId: number) {
    const response = await fetch(`${API_ROOT}/posts/${postId}`, {
        method: "DELETE",
        headers: authHeaders(),
    });

    if (!response.ok) {
        throw new Error(
            await getErrorMessage(
                response,
                "게시글 삭제에 실패했습니다."
            )
        );
    }
}

export async function likePost(postId: number) {
    const email = localStorage.getItem("email");

    if (!email) {
        throw new Error("로그인한 사용자 정보를 찾을 수 없습니다.");
    }

    const response = await fetch(`${API_ROOT}/posts/${postId}/like`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ email }),
    });

    if (!response.ok) {
        throw new Error(
            await getErrorMessage(
                response,
                "좋아요 처리에 실패했습니다."
            )
        );
    }

    return response.json() as Promise<{
        postId: number;
        likeCount: number;
        liked: boolean;
        message: string;
    }>;
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

    const params = new URLSearchParams({
        email,
    });

    const response = await fetch(
        `${API_ROOT}/posts/${postId}/like-status?${params.toString()}`,
        {
            method: "GET",
            headers: authHeaders(),
        }
    );

    if (!response.ok) {
        throw new Error(
            await getErrorMessage(
                response,
                "좋아요 상태를 불러오지 못했습니다."
            )
        );
    }

    return response.json();
}

export async function getComments(postId: number) {
    const response = await fetch(
        `${API_ROOT}/posts/${postId}/comments`,
        {
            method: "GET",
            headers: authHeaders(),
        }
    );

    if (!response.ok) {
        throw new Error(
            await getErrorMessage(
                response,
                "댓글을 불러오지 못했습니다."
            )
        );
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
        `${API_ROOT}/posts/${postId}/comments`,
        {
            method: "POST",
            headers: authHeaders(true),
            body: JSON.stringify({
                content: data.content,
                parentId: data.parentId,
                email,
            }),
        }
    );

    if (!response.ok) {
        throw new Error(
            await getErrorMessage(
                response,
                "댓글 작성에 실패했습니다."
            )
        );
    }

    return response.json();
}

export async function deleteComment(commentId: number) {
    const response = await fetch(
        `${API_ROOT}/posts/comments/${commentId}`,
        {
            method: "DELETE",
            headers: authHeaders(),
        }
    );

    if (!response.ok) {
        throw new Error(
            await getErrorMessage(
                response,
                "댓글 삭제에 실패했습니다."
            )
        );
    }
}