import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LoadTestResult } from '../../types/loadTest';
import { Badge, Card, EmptyState } from '../common';
import type { BadgeTone } from '../common';
import './LoadTestResultView.css';

export interface LoadTestResultViewProps {
  result: LoadTestResult;
}

const getGradeTone = (grade?: string): BadgeTone => {
  const normalized = grade?.toUpperCase();
  if (normalized === 'A') return 'success';
  if (normalized === 'B') return 'info';
  if (normalized === 'C' || normalized === 'D') return 'warning';
  if (normalized === 'F') return 'danger';
  return 'neutral';
};

const getSeriesBadge = (result: LoadTestResult): { label: string; tone: BadgeTone } => {
  if (result.metricsStatus === 'UNSUPPORTED_SCHEMA') {
    return { label: '지원하지 않는 형식', tone: 'danger' };
  }

  if (result.dataOrigin === 'MEASURED_K6') {
    if (!result.points?.length) return { label: '측정값 없음', tone: 'warning' };
    if (result.metricsStatus === 'COMPLETE') return { label: '실측 완료', tone: 'success' };
    if (result.metricsStatus === 'PARTIAL') return { label: '일부 측정', tone: 'warning' };
    return { label: 'k6 실측 데이터', tone: 'info' };
  }

  if (result.dataOrigin === 'LEGACY_SYNTHETIC') {
    return { label: '이전 측정 형식', tone: 'warning' };
  }

  return { label: '시계열 미수집', tone: 'neutral' };
};

const tooltipStyle = {
  backgroundColor: 'var(--color-bg-surface)',
  borderColor: 'var(--color-border-default)',
  borderRadius: 'var(--radius-md)',
};

export function LoadTestResultView({ result }: LoadTestResultViewProps) {
  const grade = result.performanceGrade?.toUpperCase() || '-';
  const avgTps = result.avgTps ?? result.maxTps ?? 0;
  const hasMeasuredSeries = result.dataOrigin === 'MEASURED_K6' && Boolean(result.points?.length);
  const isLegacySeries = result.dataOrigin === 'LEGACY_SYNTHETIC';
  const seriesBadge = getSeriesBadge(result);

  return (
    <section className="fc-load-result" aria-label="부하 테스트 결과">
      <div className="fc-load-result__metrics">
        <Card padding="sm" className="fc-load-result__metric-card">
          <span>성능 점수</span>
          <strong>{result.performanceScore ?? '-'}점</strong>
          <Badge tone={getGradeTone(grade)}>등급 {grade}</Badge>
        </Card>
        <Card padding="sm" className="fc-load-result__metric-card">
          <span>평균 처리량</span>
          <strong>{avgTps.toLocaleString()} TPS</strong>
          <small>{result.maxTps != null ? `최대 ${result.maxTps.toLocaleString()} TPS` : '전체 요청 평균'}</small>
        </Card>
        <Card padding="sm" className="fc-load-result__metric-card">
          <span>평균 응답 시간</span>
          <strong>{result.avgResponse.toLocaleString()} ms</strong>
          <small>
            {result.p95Response != null
              ? `p95 ${result.p95Response.toLocaleString()} ms`
              : 'p95 측정값 미제공'}
          </small>
        </Card>
        <Card padding="sm" className="fc-load-result__metric-card">
          <span>오류율</span>
          <strong>{result.errorRate.toLocaleString()}%</strong>
          <small>
            {result.totalRequests != null
              ? `총 ${result.totalRequests.toLocaleString()}건 요청`
              : '실패 요청 비율'}
          </small>
        </Card>
      </div>

      <Card padding="md" className="fc-load-result__report-card">
        <div className="fc-load-result__section-heading">
          <div>
            <span>Analysis</span>
            <h3>AI 성능 분석 보고서</h3>
          </div>
          <Badge tone={getGradeTone(grade)} size="md">{grade} 등급</Badge>
        </div>
        {result.bottleneckComment ? (
          <div className={`fc-load-result__markdown grade-${grade.toLowerCase()}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.bottleneckComment}</ReactMarkdown>
          </div>
        ) : (
          <EmptyState title="분석 보고서가 없습니다." description="성능 분석 내용이 생성되지 않았습니다." />
        )}
      </Card>

      <Card padding="md" className="fc-load-result__chart-card">
        <div className="fc-load-result__section-heading">
          <div>
            <span>Timeline</span>
            <h3>실측 시계열 지표</h3>
          </div>
          <Badge tone={seriesBadge.tone}>{seriesBadge.label}</Badge>
        </div>
        {hasMeasuredSeries ? (
          <>
            <div className="fc-load-result__series-meta" aria-label="시계열 수집 정보">
              <span><strong>출처</strong> k6 실측</span>
              {result.bucketSeconds != null && (
                <span><strong>집계 간격</strong> {result.bucketSeconds}초</span>
              )}
              {result.totalRequests != null && (
                <span><strong>총 요청</strong> {result.totalRequests.toLocaleString()}건</span>
              )}
              {result.metricsSchemaVersion != null && (
                <span><strong>데이터 형식</strong> v{result.metricsSchemaVersion}</span>
              )}
            </div>

            {result.metricsStatus === 'PARTIAL' && (
              <p className="fc-load-result__series-warning" role="status">
                {result.metricsWarning || '일부 구간의 측정값이 없어 차트에 빈 구간으로 표시됩니다.'}
              </p>
            )}

            <div className="fc-load-result__chart-grid">
              <section className="fc-load-result__chart-panel" aria-labelledby="throughput-chart-title">
                <div className="fc-load-result__chart-panel-heading">
                  <h4 id="throughput-chart-title">처리량과 가상 사용자</h4>
                  <p>시간대별 TPS와 활성 VU의 변화를 비교합니다.</p>
                </div>
                <div className="fc-load-result__chart" role="img" aria-label="시간대별 처리량과 가상 사용자 차트">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={result.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" />
                      <XAxis dataKey="time" stroke="var(--color-text-muted)" minTickGap={24} />
                      <YAxis yAxisId="tps" stroke="var(--color-status-success)" allowDecimals={false} />
                      <YAxis yAxisId="vus" orientation="right" stroke="var(--color-status-warning)" allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Line
                        yAxisId="tps"
                        type="linear"
                        dataKey="tps"
                        name="처리량 (TPS)"
                        stroke="var(--color-status-success)"
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                      <Line
                        yAxisId="vus"
                        type="linear"
                        dataKey="vus"
                        name="가상 사용자 (VU)"
                        stroke="var(--color-status-warning)"
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="fc-load-result__chart-panel" aria-labelledby="response-chart-title">
                <div className="fc-load-result__chart-panel-heading">
                  <h4 id="response-chart-title">응답 품질</h4>
                  <p>평균·p95 응답 시간과 오류율을 함께 확인합니다.</p>
                </div>
                <div className="fc-load-result__chart" role="img" aria-label="시간대별 응답 시간과 오류율 차트">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={result.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" />
                      <XAxis dataKey="time" stroke="var(--color-text-muted)" minTickGap={24} />
                      <YAxis yAxisId="response" stroke="var(--color-action-primary)" unit="ms" />
                      <YAxis yAxisId="error" orientation="right" stroke="var(--color-status-error)" unit="%" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Line
                        yAxisId="response"
                        type="linear"
                        dataKey="avgResponse"
                        name="평균 응답 시간 (ms)"
                        stroke="var(--color-action-primary)"
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                      <Line
                        yAxisId="response"
                        type="linear"
                        dataKey="p95Response"
                        name="p95 응답 시간 (ms)"
                        stroke="var(--color-status-warning)"
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                      <Line
                        yAxisId="error"
                        type="linear"
                        dataKey="errorRate"
                        name="오류율 (%)"
                        stroke="var(--color-status-error)"
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          </>
        ) : (
          <div className="fc-load-result__empty-series">
            <EmptyState
              title={
                isLegacySeries
                  ? '실측 시계열을 제공하지 않는 이전 결과입니다.'
                  : result.metricsStatus === 'UNSUPPORTED_SCHEMA'
                    ? '현재 화면에서 지원하지 않는 시계열 형식입니다.'
                    : '시계열 측정 데이터가 없습니다.'
              }
              description={result.metricsWarning || '전체 테스트 요약 지표만 제공됩니다.'}
            />
          </div>
        )}
      </Card>
    </section>
  );
}

export default LoadTestResultView;
