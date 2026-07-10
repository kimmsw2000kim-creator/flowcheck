import React, { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { useAlertStore } from '../../store/alertStore';

interface DailyStat {
    date: string;
    totalUsers: number;
    newUsers: number;
    totalVerifiedDomains: number;
    totalTestsRun: number;
    totalCreditsConsumed: number;
    retentionRate7d: number;
}

export default function StatsManagementTab() {
    const showAlert = useAlertStore((state) => state.showAlert);

    const [dailyStats] = useState<DailyStat[]>([
        { date: '2026-06-24', totalUsers: 142, newUsers: 12, totalVerifiedDomains: 23, totalTestsRun: 110, totalCreditsConsumed: 450000, retentionRate7d: 38.5 },
        { date: '2026-06-25', totalUsers: 154, newUsers: 12, totalVerifiedDomains: 25, totalTestsRun: 125, totalCreditsConsumed: 520000, retentionRate7d: 41.2 },
        { date: '2026-06-26', totalUsers: 168, newUsers: 14, totalVerifiedDomains: 28, totalTestsRun: 140, totalCreditsConsumed: 600000, retentionRate7d: 40.8 },
        { date: '2026-06-27', totalUsers: 180, newUsers: 12, totalVerifiedDomains: 31, totalTestsRun: 165, totalCreditsConsumed: 580000, retentionRate7d: 42.5 },
        { date: '2026-06-28', totalUsers: 195, newUsers: 15, totalVerifiedDomains: 33, totalTestsRun: 190, totalCreditsConsumed: 700000, retentionRate7d: 44.1 },
        { date: '2026-06-29', totalUsers: 210, newUsers: 15, totalVerifiedDomains: 36, totalTestsRun: 210, totalCreditsConsumed: 850000, retentionRate7d: 45.0 }
    ]);

    return (
        <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>일일 플랫폼 운영 성능 (7일 리텐션)</h3>
            <button
                className="btn btn-primary"
                style={{ marginBottom: '1rem' }}
                onClick={() => showAlert('금일 플랫폼 운영 지표 및 데일리 집계가 업데이트되었습니다.', 'success')}
            >
                배치 통계 집계 실행
            </button>

            <div style={{ height: '320px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="date" stroke="var(--text-muted)" />
                        <YAxis stroke="var(--accent)" />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }} />
                        <Legend />
                        <Line type="monotone" dataKey="retentionRate7d" name="7일 리텐션 비율 (%)" stroke="var(--success)" activeDot={{ r: 8 }} />
                        <Line type="monotone" dataKey="totalTestsRun" name="일일 누적 테스트 횟수" stroke="var(--accent)" />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
