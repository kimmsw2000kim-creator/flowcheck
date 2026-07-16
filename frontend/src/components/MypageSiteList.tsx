import type { SiteSummary } from '../types/mypage';
import { Badge, EmptyState, Table, TableContainer } from './common';
import styles from '../styles/mypage.module.css';

interface MypageSiteListProps {
  sites: SiteSummary[];
}

function MypageSiteList({ sites }: MypageSiteListProps) {
  if (sites.length === 0) {
    return (
      <EmptyState
        title="등록된 사이트가 없습니다."
        description="도메인 관리에서 사이트를 등록하면 여기에 표시됩니다."
      />
    );
  }

  return (
    <TableContainer>
      <Table className={styles['mypage-site-table']}>
        <thead>
          <tr>
            <th>서비스</th>
            <th>도메인</th>
            <th>등록일</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => (
            <tr key={site.siteId}>
              <td>{site.serviceName || '이름 없는 사이트'}</td>
              <td className={styles['break-all']}>{site.domainURL}</td>
              <td>{site.createdAt || '-'}</td>
              <td>
                <Badge tone={site.isVerified ? 'success' : 'warning'}>
                  {site.isVerified ? '인증 완료' : '인증 대기'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableContainer>
  );
}

export default MypageSiteList;
