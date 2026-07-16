import { CheckCircle, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  StatusBadge,
  Table,
  TableContainer,
} from '../components/common';
import TextField from '../components/common/TextField';
import { useDomains } from '../hooks/useDomains';
import '../styles/DomainsPage.css';

export default function DomainsPage() {
  const {
    domains,
    newDomainUrl,
    setNewDomainUrl,
    handleAddDomain,
    handleVerifyDomain,
    handleDeleteDomain,
    verificationLoading,
  } = useDomains();

  const verifiedCount = domains.filter((domain) => domain.verified).length;
  const unverifiedCount = domains.length - verifiedCount;

  return (
    <div className="domains-page">
      <PageHeader
        headingLevel={2}
        title="도메인 소유권 검증 및 관리"
        description="테스트할 웹사이트를 등록하고 소유권 검증 상태를 관리합니다."
      />

      <Card as="section" padding="md">
        <div className="domains-page__section-heading">
          <span>Registration</span>
          <h3>새로운 사이트 등록</h3>
        </div>
        <form className="domains-page__form" onSubmit={handleAddDomain}>
          <TextField
            type="url"
            label="도메인 URL"
            description="https://를 포함한 웹사이트 주소를 입력하세요."
            placeholder="https://mybusiness.com"
            value={newDomainUrl}
            onChange={(event) => setNewDomainUrl(event.target.value)}
            containerClassName="domains-page__url-field"
            required
          />
          <Button type="submit" variant="primary">도메인 추가</Button>
        </form>
      </Card>

      <Card as="section" padding="md">
        <div className="domains-page__section-heading domains-page__section-heading--row">
          <div className="domains-page__section-heading-copy">
            <span>Verification</span>
            <h3>소유권 검증 및 연동 목록</h3>
          </div>
          <div className="domains-page__domain-counts" aria-label="도메인 인증 현황">
            <Badge tone={verifiedCount ? 'success' : 'neutral'}>{verifiedCount}개 인증</Badge>
            <Badge tone={unverifiedCount ? 'warning' : 'neutral'}>{unverifiedCount}개 미인증</Badge>
          </div>
        </div>

        <TableContainer>
          <Table density="compact">
            <thead>
              <tr>
                <th>호스트 URL</th>
                <th>검증용 메타 태그 / 텍스트 파일 내용</th>
                <th>검증 상태 및 실행</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => (
                <tr key={domain.id}>
                  <td>
                    <strong className="domains-page__domain-url">{domain.domainUrl}</strong>
                    <small className="domains-page__registered-at">등록일: {domain.createdAt}</small>
                  </td>
                  <td>
                    {domain.verified ? (
                      <div className="domains-page__verified-message">
                        <CheckCircle size={16} aria-hidden="true" /> 검증 완료 및 연동 활성화
                      </div>
                    ) : (
                      <div className="domains-page__instructions">
                        <p>
                          웹사이트 <code>&lt;head&gt;</code> 영역에 메타 태그 추가
                          <code className="domains-page__code-block">
                            &lt;meta name=&quot;overload-verification&quot; content=&quot;{domain.verificationToken}&quot;&gt;
                          </code>
                        </p>
                        <p>
                          또는 텍스트 파일 업로드
                          <code className="domains-page__code-block">
                            {domain.domainUrl}/.well-known/overload-verification.txt
                          </code>
                          파일 내용: <code>{domain.verificationToken}</code>
                        </p>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="domains-page__actions">
                      {domain.verified ? (
                        <StatusBadge status="SUCCESS" label="인증 완료" />
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleVerifyDomain(domain.id)}
                          isLoading={verificationLoading}
                          loadingText="검증 중..."
                        >
                          지금 검증하기
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        size="sm"
                        className="domains-page__delete-button"
                        onClick={() => handleDeleteDomain(domain.id)}
                        aria-label={`${domain.domainUrl} 삭제`}
                        title="도메인 삭제"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {domains.length === 0 && (
                <tr>
                  <td colSpan={3}>
                    <EmptyState title="아직 등록된 도메인이 없습니다." description="위 입력란에서 첫 번째 테스트 도메인을 등록하세요." />
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
