import React, { useState } from 'react';

interface AdminUser {
    userId: string;
    email: string;
    role: 'USER' | 'ADMIN';
    status: 'ACTIVE' | 'SUSPENDED';
    balance: number;
    createdAt: string;
    suspendedUntil: string | null;
}

interface UserManagementTabProps {
    currentUser: {
        role: string;
        id: string;
        email: string;
    };
}

export default function UserManagementTab({ currentUser }: UserManagementTabProps) {
    const [users, setUsers] = useState<AdminUser[]>([
        { userId: '1', email: 'user1@test.com', role: 'USER', status: 'ACTIVE', balance: 10000, createdAt: '2026-06-01', suspendedUntil: null },
        { userId: '2', email: 'user2@test.com', role: 'USER', status: 'SUSPENDED', balance: 5000, createdAt: '2026-06-15', suspendedUntil: '2026-07-15' },
        { userId: '3', email: 'admin@test.com', role: 'ADMIN', status: 'ACTIVE', balance: 0, createdAt: '2026-05-20', suspendedUntil: null },
    ]);

    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const selectedUser = users.find(u => u.userId === selectedUserId) || null;

    const handleChangeRole = (userId: string, newRole: 'USER' | 'ADMIN') => {
        setUsers(prev => prev.map(u => u.userId === userId ? { ...u, role: newRole } : u));
    };

    const handleToggleStatus = (userId: string) => {
        setUsers(prev => prev.map(u =>
            u.userId === userId
                ? { ...u, status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }
                : u
        ));
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
