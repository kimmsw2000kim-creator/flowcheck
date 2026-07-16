export interface LoadChartDataPoint {
  time: string;
  tps: number;
  avgResponse: number;
}

export interface LoadTestResult {
  maxTps: number;
  avgResponse: number;
  errorRate: number;
  performanceScore: number;
  performanceGrade: string;
  scoreLabel: string;
  scoreBreakdown: {
    reliabilityScore: number;
    latencyScore: number;
  };
  bottleneckComment: string;
  points: LoadChartDataPoint[];
}
