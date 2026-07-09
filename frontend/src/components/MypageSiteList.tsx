import type { SiteSummary } from '../types/mypage';
import styles from '../styles/mypage.module.css';
import EmptyState from './common/EmptyState';
import StatusBadge from './common/StatusBadge';

interface MypageSiteListProps {
  sites: SiteSummary[];
}

function MypageSiteList({ sites }: MypageSiteListProps) {
  return (
    <section className="site-panel">
      <h2>등록 사이트</h2>

      {sites.length === 0 ? (
        <EmptyState
          title="등록된 사이트가 없습니다."
          description="도메인 관리에서 사이트를 등록하면 여기에 표시됩니다."
        />
      ) : (
        <div className={styles['site-list']}>
          {sites.map((site) => (
            <div className={styles['site-item']} key={site.siteId}>
              <div>
                <strong>{site.serviceName || '이름 없는 사이트'}</strong>
                <p>{site.domainURL}</p>
              </div>

              <StatusBadge
                status={site.isVerified ? 'SUCCESS' : 'PENDING'}
                label={site.isVerified ? '인증 완료' : '인증 대기'}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default MypageSiteList;
