import { CreditCard, PlusCircle, Shield } from 'lucide-react';
import { Badge, Button, Card, EmptyState, PageHeader, Table, TableContainer } from '../components/common';
import { useDomains } from '../hooks/useDomains';
import { useUserStore } from '../store/userStore';
import '../styles/DashboardPage.css';

interface DashboardPageProps {
  setActiveTab: (tab: string) => void;
  setSelectedUIUXTestDomain: (id: number) => void;
}

export default function DashboardPage({ setActiveTab, setSelectedUIUXTestDomain }: DashboardPageProps) {
  const currentUser = useUserStore((state) => state.currentUser);
  const { domains } = useDomains();
  const verifiedDomainCount = domains.filter((domain) => domain.verified).length;

  const runUIUXTest = (domainId: number) => {
    setSelectedUIUXTestDomain(domainId);
    setActiveTab('UIUXTest');
  };

  return (
    <div className="dashboard-page">
      <PageHeader
        headingLevel={2}
        title="FlowCheck 대시보드"
        description="크레딧 모니터링, AI UI 테스트 수행, 그리고 부하 테스트 평가를 한눈에 관리하세요."
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
            <span>부하 <strong>{currentUser.loadTestCoupons || 0}회</strong></span>
            <span>UI/UX <strong>{currentUser.UIUXTestCoupons || 0}회</strong></span>
          </div>
        </Card>
        <Card padding="md" className="dashboard-page__stat-card">
          <div className="dashboard-page__stat-label"><Shield size={18} aria-hidden="true" /> 등록된 대상 도메인</div>
          <div className="dashboard-page__stat-value">
            {domains.length} <span>{verifiedDomainCount}개 인증됨</span>
          </div>
        </Card>
      </section>

      <Card as="section" padding="md" className="dashboard-page__domains">
        <div className="dashboard-page__section-heading">
          <div>
            <span>Sites</span>
            <h3>등록된 대상 웹사이트</h3>
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
                <th>UI 테스트</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => (
                <tr key={domain.id}>
                  <td className="dashboard-page__domain-url">{domain.domainUrl}</td>
                  <td>{domain.createdAt}</td>
                  <td>
                    <Badge tone={domain.verified ? 'success' : 'warning'}>
                      {domain.verified ? '인증됨' : '대기 중'}
                    </Badge>
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => runUIUXTest(domain.id)}
                    >
                      UI/UX 테스트 실행
                    </Button>
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
