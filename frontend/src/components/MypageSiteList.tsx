interface SiteSummary {
    siteId: number;
    serviceName: string;
    domainUrl: string;
    isVerified: boolean;
    createdAt: string;
}

interface MypageSiteListProps {
    sites: SiteSummary[];
}

function MypageSiteList({ sites }: MypageSiteListProps) {
    return (
        <section className="site-panel">
            <h2>등록 사이트</h2>

            <div className="site-list">
                {sites.map((site) => (
                    <div className="site-row" key={site.siteId}>
                        <div>
                            <strong>{site.serviceName}</strong>
                            <p>{site.domainUrl}</p>
                        </div>

                        <span className={site.isVerified ? 'badge verified' : 'badge pending'}>
              {site.isVerified ? '인증 완료' : '인증 대기'}
            </span>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default MypageSiteList;