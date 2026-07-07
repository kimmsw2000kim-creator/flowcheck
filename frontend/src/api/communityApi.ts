const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5173";

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

export async function getPosts() {
    const response = await fetch(`${API_BASE_URL}/api/posts`, {
        method: "GET",
        headers: authHeaders(),
    });

    if (!response.ok) {
        throw new Error("게시글 목록을 불러오지 못했습니다.");
    }

    return response.json();
}

export async function getPost(postId) {
    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
        method: "GET",
        headers: authHeaders(),
    });

    if (!response.ok) {
        throw new Error("게시글을 불러오지 못했습니다.");
    }

    return response.json();
}

export async function createPost({ title, content }) {
    const response = await fetch(`${API_BASE_URL}/api/posts`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ title, content }),
    });

    if (!response.ok) {
        throw new Error("게시글 작성에 실패했습니다.");
    }

    return response.json();
}

export async function updatePost(postId, { title, content }) {
    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ title, content }),
    });

    if (!response.ok) {
        throw new Error("게시글 수정에 실패했습니다.");
    }

    return response.json();
}

export async function deletePost(postId) {
    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
        method: "DELETE",
        headers: authHeaders(),
    });

    if (!response.ok) {
        throw new Error("게시글 삭제에 실패했습니다.");
    }
}

export async function createComment(postId, content) {
    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/comments`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ content }),
    });

    if (!response.ok) {
        throw new Error("댓글 작성에 실패했습니다.");
    }

    return response.json();
}

export async function deleteComment(commentId) {
    const response = await fetch(`${API_BASE_URL}/api/comments/${commentId}`, {
        method: "DELETE",
        headers: authHeaders(),
    });

    if (!response.ok) {
        throw new Error("댓글 삭제에 실패했습니다.");
    }
}