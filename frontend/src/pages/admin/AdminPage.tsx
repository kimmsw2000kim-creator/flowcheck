import React, { useState } from 'react';
import UserManagementTab from './UserManagementTab';
import InquiryManagementTab from './InquiryManagementTab';
import StatsManagementTab from './StatsManagementTab';

interface AdminPageProps {
    currentUser: {
        role: string;
        id: string;
        email: string;
    };
}

export default function AdminPage({ currentUser }: AdminPageProps) {
    const [activeTab, setActiveTab] = useState<'users' | 'inquiries' | 'stats'>('users');

    return (
        <section className="admin-page">
            <h2 style={{ marginBottom: '1.5rem' }}>관리자 페이지</h2>

            <div className="admin-tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <button
                    className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    회원 관리
                </button>
                <button
                    className={`nav-item ${activeTab === 'inquiries' ? 'active' : ''}`}
                    onClick={() => setActiveTab('inquiries')}
                >
                    문의 관리
                </button>
                <button
                    className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`}
                    onClick={() => setActiveTab('stats')}
                >
                    통계
                </button>
            </div>

            {activeTab === 'users' && <UserManagementTab currentUser={currentUser} />}
            {activeTab === 'inquiries' && <InquiryManagementTab />}
            {activeTab === 'stats' && <StatsManagementTab />}
        </section>
    );
}
