import React, { useState, useEffect } from 'react';
import { fetchAdminUsers, changeUserRole, suspendUser, activateUser, AdminUser } from '../../api/adminApi';

interface UserManagementTabProps {
    currentUser: {
        role: string;
        id: string;
        email: string;
    };
}

export default function UserManagementTab({ currentUser }: UserManagementTabProps) {
    const [users, setUsers] = useState<AdminUser[]>([]);
    useEffect(() => {
        fetchAdminUsers().then(setUsers);
    }, []);



    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);


    const selectedUser = users.find(u => u.userId === selectedUserId) || null;

    const handleChangeRole = async (userId: string, newRole: 'USER' | 'ADMIN') => {
        const updated = await changeUserRole(userId, newRole);
        setUsers(prev => prev.map(u => u.userId === userId ? updated : u));
    };

    const handleToggleStatus = async (userId: string) => {
        const target = users.find(u => u.userId === userId);
        if (!target) return;
        const updated = target.status === 'ACTIVE'
            ? await suspendUser(userId)
            : await activateUser(userId);
        setUsers(prev => prev.map(u => u.userId === userId ? updated : u));
    };


    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
            <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>회원 목록</h3>
                <table className="custom-table">
                    <thead>
                        <tr>
                            <th>이메일</th>
                            <th>역할</th>
                            <th>상태</th>
                            <th>가입일</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.userId}>
                                <td>
                                    <span
                                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={() => setSelectedUserId(u.userId)}
                                    >
                                        {u.email}
                                    </span>
                                </td>
                                <td>{u.role}</td>
                                <td>{u.status}</td>
                                <td>{u.createdAt}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>회원 상세</h3>
                {selectedUser ? (
                    <div>
                        <p>이메일: {selectedUser.email}</p>
                        <p>가입일: {selectedUser.createdAt}</p>
                        <p>잔액: {selectedUser.balance}</p>
                        <p>쿠폰: {selectedUser.couponCount}</p>
                        <p>상태: {selectedUser.status}</p>

                        <div style={{ marginTop: '1rem' }}>
                            <label>권한 변경: </label>
                            <select
                                value={selectedUser.role}
                                onChange={(e) => handleChangeRole(selectedUser.userId, e.target.value as 'USER' | 'ADMIN')}
                            >
                                <option value="USER">USER</option>
                                <option value="ADMIN">ADMIN</option>
                            </select>
                        </div>

                        <button
                            className="btn btn-secondary"
                            style={{ marginTop: '1rem' }}
                            onClick={() => handleToggleStatus(selectedUser.userId)}
                        >
                            {selectedUser.status === 'ACTIVE' ? '정지 처리' : '정지 해제'}
                        </button>

                        <button
                            className="btn"
                            style={{ marginTop: '1rem', marginLeft: '0.5rem' }}
                            onClick={() => setSelectedUserId(null)}
                        >
                            닫기
                        </button>
                    </div>
                ) : (
                    <p style={{ color: 'var(--text-muted)' }}>회원 이메일을 클릭하면 상세 정보가 표시됩니다.</p>
                )}
            </div>
        </div>
    );
}
