export interface LoadChartDataPoint {
  time: string;
  elapsedSeconds?: number | null;
  tps: number;
  avgResponse: number | null;
  p95Response?: number | null;
  errorRate?: number | null;
  vus?: number | null;
}

export interface LoadTestResult {
  totalRequests?: number | null;
  avgTps: number;
  maxTps: number | null;
  avgResponse: number;
  p95Response?: number | null;
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
  metricsStatus: string;
  metricsWarning?: string | null;
  dataOrigin: string;
  bucketSeconds?: number | null;
}
