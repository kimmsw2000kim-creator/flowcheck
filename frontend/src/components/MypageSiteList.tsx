import type { SiteSummary } from '../types/mypage';

interface MypageSiteListProps {
  sites: SiteSummary[];
}

function MypageSiteList({ sites }: MypageSiteListProps) {
  return (
    <section className="site-panel">
      <h2>등록 사이트</h2>

      {sites.length === 0 ? (
        <div className="empty-state">
          <strong>등록된 사이트가 없습니다.</strong>
          <p>도메인 관리에서 사이트를 등록하면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="site-list">
          {sites.map((site) => (
            <div className="site-item" key={site.siteId}>
              <div>
                <strong>{site.serviceName || '이름 없는 사이트'}</strong>
                <p>{site.domainUrl}</p>
              </div>

              <span className={`status-badge ${site.isVerified ? '' : 'pending'}`}>
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