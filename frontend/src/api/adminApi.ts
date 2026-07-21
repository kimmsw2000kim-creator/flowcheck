import apiClient from './client';
import { getKoreanErrorMessage } from '../utils/errorMessage';

export interface AdminUser {
    userId: string;
    email: string;
    role: 'USER' | 'ADMIN';
    status: string;
    balance: number;
    createdAt: string;
    suspendedUntil: string | null;
    statusChangedAt: string | null;
    couponCount: number;
}

export const fetchAdminUsers = async (): Promise<AdminUser[]> => {
    try {
        const response = await apiClient.get<AdminUser[]>('/api/admin/users');
        return response.data;
    } catch (error) {
        throw new Error(getKoreanErrorMessage(error, '회원 목록을 불러오지 못했습니다.'));
    }
};

export const changeUserRole = async (userId: string, role: 'USER' | 'ADMIN'): Promise<AdminUser> => {
    try {
        const response = await apiClient.patch<AdminUser>(`/api/admin/users/${userId}/role`, { role });
        return response.data;
    } catch (error) {
        throw new Error(getKoreanErrorMessage(error, '회원 권한을 변경하지 못했습니다.'));
    }
};

export const suspendUser = async (userId: string): Promise<AdminUser> => {
    try {
        const response = await apiClient.patch<AdminUser>(`/api/admin/users/${userId}/suspend`);
        return response.data;
    } catch (error) {
        throw new Error(getKoreanErrorMessage(error, '회원 이용을 정지하지 못했습니다.'));
    }
};

export const blockUser = async (userId: string): Promise<AdminUser> => {
    try {
        const response = await apiClient.patch<AdminUser>(`/api/admin/users/${userId}/block`);
        return response.data;
    } catch (error) {
        throw new Error(getKoreanErrorMessage(error, '회원을 차단하지 못했습니다.'));
    }
};

export const unblockUser = async (userId: string): Promise<AdminUser> => {
    try {
        const response = await apiClient.patch<AdminUser>(`/api/admin/users/${userId}/unblock`);
        return response.data;
    } catch (error) {
        throw new Error(getKoreanErrorMessage(error, '회원 차단을 해제하지 못했습니다.'));
    }
};

export const activateUser = async (userId: string): Promise<AdminUser> => {
    try {
        const response = await apiClient.patch<AdminUser>(`/api/admin/users/${userId}/activate`);
        return response.data;
    } catch (error) {
        throw new Error(getKoreanErrorMessage(error, '회원 계정을 활성화하지 못했습니다.'));
    }
};

