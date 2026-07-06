import axios from 'axios';

export interface AuthParams {
    email: string;
    password?: string;
    nickname?: string;
}

export async function signup({ email, password, nickname }: AuthParams): Promise<any> {
    try {
        const response = await axios.post('/api/auth/signup', {
            email,
            password,
            nickname,
        });

        return response.data;
    } catch (error: any) {
        const message =
            error.response?.data?.message ||
            error.response?.data?.error ||
            '회원가입에 실패했습니다.';

        throw new Error(message);
    }
}

export async function login({ email, password }: AuthParams): Promise<any> {
    try {
        const response = await axios.post('/api/auth/login', {
            email,
            password,
        });

        const data = response.data;

        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('email', data.email);

        return data;
    } catch (error: any) {
        const message =
            error.response?.data?.message ||
            error.response?.data?.error ||
            '로그인에 실패했습니다.';

        throw new Error(message);
    }
}

export function logout(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('email');
}

export function getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
}

export function getCurrentEmail(): string | null {
    return localStorage.getItem('email');
}