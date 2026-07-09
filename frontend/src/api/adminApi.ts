import axios from 'axios';

export interface AdminUser {
    userId: string;
    email: string;
    role: 'USER' | 'ADMIN';
    status: string;
    balance: number;
    createdAt: string;
    suspendedUntil: string | null;
    couponCount: number;
}

export const fetchAdminUsers = async (): Promise<AdminUser[]> => {
    const response = await axios.get<AdminUser[]>('/api/admin/users');
    return response.data;
};

export const changeUserRole = async (userId: string, role: 'USER' | 'ADMIN'): Promise<AdminUser> => {
    const response = await axios.patch<AdminUser>(`/api/admin/users/${userId}/role`, { role });
    return response.data;
};

export const suspendUser = async (userId: string): Promise<AdminUser> => {
    const response = await axios.patch<AdminUser>(`/api/admin/users/${userId}/suspend`);
    return response.data;
};

export const activateUser = async (userId: string): Promise<AdminUser> => {
    const response = await axios.patch<AdminUser>(`/api/admin/users/${userId}/activate`);
    return response.data;
};
