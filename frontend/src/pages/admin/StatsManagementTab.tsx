import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button, Card } from '../../components/common';
import { useAlertStore } from '../../store/alertStore';

interface DailyStat { date: string; totalUsers: number; newUsers: number; totalVerifiedDomains: number; totalTestsRun: number; totalCreditsConsumed: number; retentionRate7d: number; }

const dailyStats: DailyStat[] = [
  { date: '2026-06-24', totalUsers: 142, newUsers: 12, totalVerifiedDomains: 23, totalTestsRun: 110, totalCreditsConsumed: 450000, retentionRate7d: 38.5 },
  { date: '2026-06-25', totalUsers: 154, newUsers: 12, totalVerifiedDomains: 25, totalTestsRun: 125, totalCreditsConsumed: 520000, retentionRate7d: 41.2 },
  { date: '2026-06-26', totalUsers: 168, newUsers: 14, totalVerifiedDomains: 28, totalTestsRun: 140, totalCreditsConsumed: 600000, retentionRate7d: 40.8 },
  { date: '2026-06-27', totalUsers: 180, newUsers: 12, totalVerifiedDomains: 31, totalTestsRun: 165, totalCreditsConsumed: 580000, retentionRate7d: 42.5 },
  { date: '2026-06-28', totalUsers: 195, newUsers: 15, totalVerifiedDomains: 33, totalTestsRun: 190, totalCreditsConsumed: 700000, retentionRate7d: 44.1 },
  { date: '2026-06-29', totalUsers: 210, newUsers: 15, totalVerifiedDomains: 36, totalTestsRun: 210, totalCreditsConsumed: 850000, retentionRate7d: 45 },
];

export default function StatsManagementTab() {
  const showAlert = useAlertStore((state) => state.showAlert);
  return (
    <Card as="section">
      <h2 className="utility-card-title">일일 플랫폼 운영 성능</h2>
      <p className="utility-card-description">정적 데모 데이터를 기준으로 7일 리텐션과 테스트 실행량을 표시합니다.</p>
      <Button type="button" onClick={() => showAlert('금일 플랫폼 운영 지표 및 데일리 집계가 업데이트되었습니다.', 'success')}>배치 통계 집계 실행</Button>
      <div className="admin-chart" aria-label="일일 플랫폼 운영 성능 차트">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dailyStats}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" />
            <XAxis dataKey="date" stroke="var(--color-text-muted)" />
            <YAxis stroke="var(--color-action-primary)" />
            <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)', borderRadius: 'var(--radius-md)' }} />
            <Legend />
            <Line type="monotone" dataKey="retentionRate7d" name="7일 리텐션 비율 (%)" stroke="var(--color-status-success)" activeDot={{ r: 8 }} />
            <Line type="monotone" dataKey="totalTestsRun" name="일일 누적 테스트 횟수" stroke="var(--color-action-primary)" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
