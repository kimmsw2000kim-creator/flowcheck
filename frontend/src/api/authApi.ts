const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5173";

export interface AuthParams {
  email: string;
  password?: string;
  nickname?: string;
}

export async function signup({ email, password, nickname }: AuthParams): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            email,
            password,
            nickname,
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || "회원가입에 실패했습니다.");
    }

    return response.json();
}

export async function login({ email, password }: AuthParams): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            email,
            password,
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || "로그인에 실패했습니다.");
    }

    const data = await response.json();

    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    localStorage.setItem("email", data.email);

    return data;
}

export function logout(): void {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("email");
}

export function getAccessToken(): string | null {
    return localStorage.getItem("accessToken");
}

export function getCurrentEmail(): string | null {
    return localStorage.getItem("email");
}
