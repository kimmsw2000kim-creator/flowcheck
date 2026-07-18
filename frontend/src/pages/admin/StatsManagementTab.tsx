import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchAdminStats } from '../../api/adminStatsApi';
import { Button, Card, EmptyState } from '../../components/common';
import type { AdminStats } from '../../types/adminStats';

const numberFormatter = new Intl.NumberFormat('ko-KR');

export default function StatsManagementTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      setStats(await fetchAdminStats());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '관리자 통계를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const summaryItems = stats ? [
    { label: '전체 회원', value: `${numberFormatter.format(stats.totalUsers)}명` },
    { label: '활성 회원', value: `${numberFormatter.format(stats.activeUsers)}명` },
    { label: '인증 도메인', value: `${numberFormatter.format(stats.verifiedDomains)}개` },
    { label: '전체 테스트', value: `${numberFormatter.format(stats.totalTests)}회` },
    { label: '완료 테스트', value: `${numberFormatter.format(stats.completedTests)}회` },
    { label: '사용 크레딧', value: `${numberFormatter.format(stats.creditsConsumed)}P` },
  ] : [];

  return (
    <Card as="section">
      <div className="admin-stats-toolbar">
        <div>
          <h2 className="utility-card-title">플랫폼 운영 통계</h2>
          <p className="utility-card-description">현재 누적 지표와 최근 7일 활동을 실제 데이터로 집계합니다.</p>
        </div>
        <Button type="button" variant="secondary" icon={RefreshCw} isLoading={loading && stats !== null} loadingText="갱신 중..." onClick={() => { void loadStats(); }}>
          새로고침
        </Button>
      </div>

      {loading && !stats ? (
        <EmptyState title="운영 통계를 집계하는 중입니다." description="잠시만 기다려 주세요." />
      ) : errorMessage && !stats ? (
        <EmptyState title={errorMessage} description="서버 상태와 관리자 권한을 확인해 주세요." action={<Button type="button" onClick={() => { void loadStats(); }}>다시 시도</Button>} />
      ) : stats ? (
        <>
          <div className="admin-stats-grid">
            {summaryItems.map((item) => (
              <Card key={item.label} variant="subtle" padding="sm" className="admin-stat-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </Card>
            ))}
          </div>

          <div className="admin-chart" aria-label="최근 7일 신규 회원과 테스트 실행 추이 차트">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.dailyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" />
                <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} stroke="var(--color-text-muted)" />
                <YAxis allowDecimals={false} stroke="var(--color-action-primary)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)', borderRadius: 'var(--radius-md)' }} />
                <Legend />
                <Line type="monotone" dataKey="newUsers" name="신규 회원" stroke="var(--color-status-success)" activeDot={{ r: 7 }} />
                <Line type="monotone" dataKey="testsRun" name="테스트 실행" stroke="var(--color-action-primary)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <p className="admin-stats-updated">
            마지막 집계: {new Date(stats.generatedAt).toLocaleString('ko-KR')}
          </p>
        </>
      ) : null}
    </Card>
  );
}
