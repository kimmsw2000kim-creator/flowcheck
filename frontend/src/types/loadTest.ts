export interface LoadChartDataPoint {
  time: string;
  elapsedSeconds?: number | null;
  tps: number;
  avgResponse: number | null;
  p95Response?: number | null;
  errorRate?: number | null;
  vus?: number | null;
}

export interface LoadStageAnalysis {
  stage: string;
  startSecond: number;
  endSecond: number;
  minVus: number;
  maxVus: number;
  avgVus: number;
  requestCount: number;
  avgTps: number;
  maxTps: number;
  tpsPerVu: number;
  avgResponse?: number | null;
  p95Response?: number | null;
  errorRate?: number | null;
}

export interface LoadBottleneckSignal {
  type: string;
  severity: string;
  firstObservedSecond?: number | null;
  evidence: string;
}

export interface LoadAnalysisAction {
  priority: number;
  title: string;
  rationale: string;
  evidence: string;
}

export interface LoadAnalysisReport {
  schemaVersion: number;
  generationSource: string;
  verdict: string;
  stages: LoadStageAnalysis[];
  bottlenecks: LoadBottleneckSignal[];
  actions: LoadAnalysisAction[];
  limitations: string[];
  sustainableTps?: number | null;
}

export interface LoadScoreTargets {
  targetTps?: number | null;
  targetP95Ms: number;
  maxErrorRate: number;
}

export interface LoadDiagnosticMetrics {
  timing: {
    blockedMs?: number | null;
    connectingMs?: number | null;
    tlsHandshakingMs?: number | null;
    sendingMs?: number | null;
    waitingMs?: number | null;
    receivingMs?: number | null;
  };
  iterations: number;
  droppedIterations: number;
  checkFailureRate?: number | null;
  statusCodes: Record<string, number>;
  requests: Array<{
    name: string;
    requests: number;
    avgResponse?: number | null;
    errorRate?: number | null;
  }>;
  executionExitCode?: number | null;
  thresholdFailures: string[];
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
    scalabilityScore?: number | null;
  };
  scoreVersion?: number;
  scoreStatus?: string;
  scoreTargets?: LoadScoreTargets | null;
  bottleneckComment: string;
  analysisReport?: LoadAnalysisReport | null;
  diagnosticMetrics?: LoadDiagnosticMetrics | null;
  points: LoadChartDataPoint[];
  metricsStatus: string;
  metricsWarning?: string | null;
  dataOrigin: string;
  bucketSeconds?: number | null;
  metricsSchemaVersion?: number | null;
}
