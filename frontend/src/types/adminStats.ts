export interface AdminDailyStats {
  date: string;
  newUsers: number;
  testsRun: number;
  creditsConsumed: number;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  verifiedDomains: number;
  totalTests: number;
  completedTests: number;
  creditsConsumed: number;
  dailyStats: AdminDailyStats[];
  generatedAt: string;
}
