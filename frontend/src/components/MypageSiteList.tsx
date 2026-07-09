import type { SiteSummary } from '../types/mypage';
import styles from '../styles/mypage.module.css';

interface MypageSiteListProps {
  sites: SiteSummary[];
}

function MypageSiteList({ sites }: MypageSiteListProps) {
  return (
    <section className="site-panel">
      <h2>등록 사이트</h2>

      {sites.length === 0 ? (
        <div className={styles['empty-state']}>
          <strong>등록된 사이트가 없습니다.</strong>
          <p>도메인 관리에서 사이트를 등록하면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className={styles['site-list']}>
          {sites.map((site) => (
            <div className={styles['site-item']} key={site.siteId}>
              <div>
                <strong>{site.serviceName || '이름 없는 사이트'}</strong>
                <p>{site.domainURL}</p>
              </div>

              <span className={`${styles['status-badge']} ${site.isVerified ? '' : styles.pending}`}>
                {site.isVerified ? '인증 완료' : '인증 대기'}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default MypageSiteList;
