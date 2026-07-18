export interface SiteSummary {
  siteId: number;
  serviceName: string;
  domainURL: string;
  isVerified: boolean;
  createdAt: string;
}

export interface MypageData {
  email: string;
  avatarUrl?: string | null;
  role?: string;
  status?: string;
  balance: number;
  couponCount: number;
  loadTestCouponCount: number;
  UIUXTestCouponCount: number;
  registeredSiteCount: number;
  testRunCount: number;
  sites: SiteSummary[];
}

export interface MypageTestHistoryItem {
  requestId: string;
  testType: 'LOAD' | 'UI' | 'UIUX' | string;
  testName: string;
  targetUrl: string;
  status: string;
  phase: string | null;
  progress: number | null;
  overallScore?: number | null;
  scoreUsability?: number | null;
  scoreAccessibility?: number | null;
  scoreEfficiency?: number | null;
  scorePerformance?: number | null;
  scoreBestPractices?: number | null;
  description: string | null;
  createdAt: string;
  updatedAt: string | null;

  // 이미 공유한 테스트라면 연결된 커뮤니티 게시글 ID가 들어옵니다.
  linkedPostId: number | null;
}

export interface MypagePointHistoryItem {
  ledgerId: number;
  amount: number;
  transactionType: string;
  description: string;
  createdAt: string;
}

export interface MypageCouponHistoryItem {
  logId: number;
  couponType: string;
  description: string;
  usedAt: string;
}
