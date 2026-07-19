import apiClient from './client';

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
    const response = await apiClient.get<AdminUser[]>('/api/admin/users');
    return response.data;
};

export const changeUserRole = async (userId: string, role: 'USER' | 'ADMIN'): Promise<AdminUser> => {
    const response = await apiClient.patch<AdminUser>(`/api/admin/users/${userId}/role`, { role });
    return response.data;
};

export const suspendUser = async (userId: string): Promise<AdminUser> => {
    const response = await apiClient.patch<AdminUser>(`/api/admin/users/${userId}/suspend`);
    return response.data;
};

export const blockUser = async (userId: string): Promise<AdminUser> => {
    const response = await apiClient.patch<AdminUser>(`/api/admin/users/${userId}/block`);
    return response.data;
};

export const unblockUser = async (userId: string): Promise<AdminUser> => {
    const response = await apiClient.patch<AdminUser>(`/api/admin/users/${userId}/unblock`);
    return response.data;
};

export const activateUser = async (userId: string): Promise<AdminUser> => {
    const response = await apiClient.patch<AdminUser>(`/api/admin/users/${userId}/activate`);
    return response.data;
};

