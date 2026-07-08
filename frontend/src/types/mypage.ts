export interface SiteSummary {
  siteId: number;
  serviceName: string;
  domainURL: string;
  isVerified: boolean;
  createdAt: string;
}

export interface MypageData {
  email: string;
  balance: number;
  couponCount: number;
  loadTestCouponCount: number;
  uiUxTestCouponCount: number;
  registeredSiteCount: number;
  testRunCount: number;
  sites: SiteSummary[];
}

export interface MypageTestHistoryItem {
  requestId: string;
  testType: 'LOAD' | 'UI' | string;
  testName: string;
  targetUrl: string;
  status: string;
  phase: string | null;
  progress: number | null;
  description: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface MypagePointHistoryItem {
  ledgerId: number;
  amount: number;
  transactionType : string;
  description: string;
  createdAt: string;
}