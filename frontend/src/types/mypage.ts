export interface SiteSummary {
  siteId: number;
  serviceName: string;
  domainUrl: string;
  isVerified: boolean;
  createdAt: string;
}

export interface MypageData {
  email: string;
  balance: number;
  couponCount: number;
  registeredSiteCount: number;
  testRunCount: number;
  sites: SiteSummary[];
}