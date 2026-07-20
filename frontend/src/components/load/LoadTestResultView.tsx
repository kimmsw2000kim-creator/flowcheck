import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageCircleQuestion } from 'lucide-react';
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
import { useChatbotStore } from '../../store/chatbotStore';
import { Badge, Button, Card, EmptyState } from '../common';
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

const formatStageLabel = (stage: string) => {
  const declaredStage = /^STAGE_(\d+)_TARGET_(\d+)$/.exec(stage);
  if (declaredStage) return `단계 ${declaredStage[1]} · 목표 ${declaredStage[2]} VU`;
  const labels: Record<string, string> = {
    LOW_LOAD: '저부하',
    MEDIUM_LOAD: '중부하',
    HIGH_LOAD: '고부하',
    RAMP_DOWN: '부하 감소',
  };
  return labels[stage] || stage;
};

export function LoadTestResultView({ result }: LoadTestResultViewProps) {
  const grade = result.performanceGrade?.toUpperCase() || '-';
  const avgTps = result.avgTps ?? result.maxTps ?? 0;
  const hasMeasuredSeries = result.dataOrigin === 'MEASURED_K6' && Boolean(result.points?.length);
  const isLegacySeries = result.dataOrigin === 'LEGACY_SYNTHETIC';
  const seriesBadge = getSeriesBadge(result);
  const openChatbotWithPrompt = useChatbotStore((state) => state.openWithPrompt);
  const explainVerdict = () => {
    const verdict = result.analysisReport?.verdict;
    if (!verdict) return;
    openChatbotWithPrompt(
      `다음 부하 테스트 성능 분석의 종합 판정만 비전문가도 이해할 수 있도록 쉬운 한국어로 설명해 주세요.\n\n종합 판정: ${verdict}`,
    );
  };

  return (
    <section className="fc-load-result" aria-label="부하 테스트 결과">
      <div className="fc-load-result__metrics">
        <Card padding="sm" className="fc-load-result__metric-card">
          <span>성능 점수</span>
          <strong>{result.performanceScore ?? '-'}점</strong>
          <Badge tone={getGradeTone(grade)}>
            등급 {grade} · v{result.scoreVersion ?? 1}
          </Badge>
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
        {result.analysisReport ? (
          <div className="fc-load-result__structured-report">
            <div className="fc-load-result__verdict">
              <div>
                <span>종합 판정</span>
                <p>{result.analysisReport.verdict}</p>
              </div>
              <div className="fc-load-result__verdict-actions">
                <Badge tone={result.analysisReport.generationSource === 'LLM' ? 'info' : 'warning'}>
                  {result.analysisReport.generationSource === 'LLM' ? 'AI 분석' : '검증 폴백'}
                </Badge>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={MessageCircleQuestion}
                  onClick={explainVerdict}
                >
                  쉽게 설명해줘
                </Button>
              </div>
            </div>

            <div className="fc-load-result__report-summary">
              <span>
                <strong>점수 기준</strong>{' '}
                {result.scoreStatus === 'CUSTOM_SLO' ? '사용자 SLO' : result.scoreVersion === 2 ? '기본 SLO' : '기존 기준'}
              </span>
              {result.analysisReport.sustainableTps != null && (
                <span><strong>지속 가능 TPS</strong> {result.analysisReport.sustainableTps.toLocaleString()}</span>
              )}
              {result.scoreTargets && (
                <span>
                  <strong>목표</strong> p95 {result.scoreTargets.targetP95Ms.toLocaleString()}ms · 오류율 {result.scoreTargets.maxErrorRate}%
                  {result.scoreTargets.targetTps != null ? ` · ${result.scoreTargets.targetTps.toLocaleString()} TPS` : ''}
                </span>
              )}
            </div>

            {result.analysisReport.stages.length > 0 && (
              <section className="fc-load-result__report-section" aria-labelledby="stage-analysis-title">
                <h4 id="stage-analysis-title">단계별 성능</h4>
                <div className="fc-load-result__table-wrap">
                  <table className="fc-load-result__stage-table">
                    <thead>
                      <tr>
                        <th>부하 단계</th>
                        <th>VU</th>
                        <th>평균 / 최대 TPS</th>
                        <th>평균 / p95</th>
                        <th>오류율</th>
                        <th>요청 수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.analysisReport.stages.map((stage) => (
                        <tr key={`${stage.stage}-${stage.startSecond}`}>
                          <th scope="row">{formatStageLabel(stage.stage)}</th>
                          <td>{stage.minVus}–{stage.maxVus}</td>
                          <td>{stage.avgTps.toLocaleString()} / {stage.maxTps.toLocaleString()}</td>
                          <td>
                            {stage.avgResponse?.toLocaleString() ?? '-'} / {stage.p95Response?.toLocaleString() ?? '-'} ms
                          </td>
                          <td>{stage.errorRate?.toLocaleString() ?? '-'}%</td>
                          <td>{stage.requestCount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {result.analysisReport.bottlenecks.length > 0 && (
              <section className="fc-load-result__report-section" aria-labelledby="bottleneck-title">
                <h4 id="bottleneck-title">병목 징후</h4>
                <ul className="fc-load-result__evidence-list">
                  {result.analysisReport.bottlenecks.map((signal) => (
                    <li key={`${signal.type}-${signal.firstObservedSecond ?? 'unknown'}`}>
                      <Badge tone={signal.severity === 'HIGH' ? 'danger' : 'warning'}>{signal.severity}</Badge>
                      <span>{signal.evidence}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="fc-load-result__report-section" aria-labelledby="action-title">
              <h4 id="action-title">우선 조치</h4>
              <ol className="fc-load-result__action-list">
                {result.analysisReport.actions.map((action) => (
                  <li key={`${action.priority}-${action.title}`}>
                    <strong>{action.title}</strong>
                    <p>{action.rationale}</p>
                    <small>근거: {action.evidence}</small>
                  </li>
                ))}
              </ol>
            </section>

            {result.analysisReport.limitations.length > 0 && (
              <section className="fc-load-result__report-section fc-load-result__limitations" aria-labelledby="limitation-title">
                <h4 id="limitation-title">분석 한계</h4>
                <ul>
                  {result.analysisReport.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
                </ul>
              </section>
            )}
          </div>
        ) : result.bottleneckComment ? (
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
