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

export function LoadTestResultView({ result }: LoadTestResultViewProps) {
  const grade = result.performanceGrade?.toUpperCase() || '-';

  return (
    <section className="fc-load-result" aria-label="부하 테스트 결과">
      <div className="fc-load-result__metrics">
        <Card padding="sm" className="fc-load-result__metric-card">
          <span>성능 점수</span>
          <strong>{result.performanceScore ?? '-'}점</strong>
          <Badge tone={getGradeTone(grade)}>등급 {grade}</Badge>
        </Card>
        <Card padding="sm" className="fc-load-result__metric-card">
          <span>최대 처리량</span>
          <strong>{result.maxTps.toLocaleString()} TPS</strong>
          <small>{result.scoreLabel || '측정 완료'}</small>
        </Card>
        <Card padding="sm" className="fc-load-result__metric-card">
          <span>평균 응답 시간</span>
          <strong>{result.avgResponse.toLocaleString()} ms</strong>
          <small>전체 요청 평균</small>
        </Card>
        <Card padding="sm" className="fc-load-result__metric-card">
          <span>오류율</span>
          <strong>{result.errorRate.toLocaleString()}%</strong>
          <small>실패 요청 비율</small>
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
            <h3>응답 시간 및 처리량</h3>
          </div>
        </div>
        {result.points?.length ? (
          <div className="fc-load-result__chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" />
                <XAxis dataKey="time" stroke="var(--color-text-muted)" />
                <YAxis yAxisId="left" stroke="var(--color-action-primary)" />
                <YAxis yAxisId="right" orientation="right" stroke="var(--color-status-success)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                    borderRadius: 'var(--radius-md)',
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="avgResponse"
                  name="평균 응답 시간 (ms)"
                  stroke="var(--color-action-primary)"
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="tps"
                  name="초당 처리량 (TPS)"
                  stroke="var(--color-status-success)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState title="차트 데이터가 없습니다." description="시간대별 측정 결과가 기록되지 않았습니다." />
        )}
      </Card>
    </section>
  );
}

export default LoadTestResultView;
