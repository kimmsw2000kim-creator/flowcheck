import { CreditCard, PlusCircle } from 'lucide-react';
import { Badge, Button, Card, EmptyState, PageHeader, Table, TableContainer } from '../components/common';
import { useDomains } from '../hooks/useDomains';
import { useUserStore } from '../store/userStore';
import '../styles/DashboardPage.css';
import { formatDate } from '../utils/date';

interface DashboardPageProps {
  setActiveTab: (tab: string) => void;
  setSelectedUIUXTestDomain: (id: number) => void;
  setSelectedLoadTestDomain: (id: number) => void;
}

export default function DashboardPage({
  setActiveTab,
  setSelectedUIUXTestDomain,
  setSelectedLoadTestDomain,
}: DashboardPageProps) {
  const currentUser = useUserStore((state) => state.currentUser);
  const { domains } = useDomains();
  const verifiedDomainCount = domains.filter((domain) => domain.verified).length;

  const runUIUXTest = (domainId: number) => {
    setSelectedUIUXTestDomain(domainId);
    setActiveTab('UIUXTest');
  };

  const runLoadTest = (domainId: number) => {
    setSelectedLoadTestDomain(domainId);
    setActiveTab('load');
  };

  return (
    <div className="dashboard-page">
      <PageHeader
        headingLevel={2}
        title="대시보드"
        description="크레딧/쿠폰 잔액, 테스트 수행, 웹사이트 등록 현황을 한눈에 관리하세요."
      />

      <section className="dashboard-page__stats" aria-label="계정 및 테스트 현황">
        <Card padding="md" className="dashboard-page__stat-card">
          <div className="dashboard-page__stat-label"><CreditCard size={18} aria-hidden="true" /> 보유 크레딧 잔액</div>
          <div className="dashboard-page__stat-value dashboard-page__stat-value--accent">
            {currentUser.balance.toLocaleString()} <span>크레딧</span>
          </div>
        </Card>
        <Card padding="md" className="dashboard-page__stat-card">
          <div className="dashboard-page__stat-label"><PlusCircle size={18} aria-hidden="true" /> 선결제 테스트 쿠폰</div>
          <div className="dashboard-page__coupon-values">
            <span>부하 <strong>{currentUser.loadTestCoupons || '-'}회</strong></span>
            <span>UI/UX <strong>{currentUser.UIUXTestCoupons || '-'}회</strong></span>
          </div>
        </Card>
      </section>

      <Card as="section" padding="md" className="dashboard-page__domains">
        <div className="dashboard-page__section-heading">
          <div>
            <span>Sites</span>
            <h3>웹사이트 등록 현황</h3>
          </div>
          <Badge tone={verifiedDomainCount ? 'success' : 'neutral'}>{verifiedDomainCount}개 인증</Badge>
        </div>

        <TableContainer>
          <Table density="compact">
            <thead>
              <tr>
                <th>도메인 호스트 URL</th>
                <th>등록일</th>
                <th>상태</th>
                <th className="dashboard-page__test-column">테스트</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => (
                <tr key={domain.id}>
                  <td className="dashboard-page__domain-url">{domain.domainUrl}</td>
                  <td>{formatDate(domain.createdAt)}</td>
                  <td>
                    <Badge tone={domain.verified ? 'success' : 'warning'}>
                      {domain.verified ? '인증됨' : '대기 중'}
                    </Badge>
                  </td>
                  <td className="dashboard-page__test-column">
                    {domain.verified && (
                      <div className="dashboard-page__test-actions">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => runUIUXTest(domain.id)}
                        >
                          UI/UX 테스트 시작
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => runLoadTest(domain.id)}
                        >
                          부하 테스트 시작
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {domains.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <EmptyState title="등록된 도메인이 없습니다." description="도메인을 등록하면 테스트 상태를 여기서 확인할 수 있습니다." />
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </TableContainer>
      </Card>
    </div>
  );
}
