import { useCallback, useId, useMemo, useRef, useState } from 'react';
import type { UIUXTestStatusResponse } from '../../api/UIUXTestApi';
import UIUXScoreBarChart from '../dashboard/UIUXScoreBarChart';
import UIUXScoreRadarChart from '../dashboard/UIUXScoreRadarChart';
import CustomVideoPlayer, { type CustomVideoPlayerRef } from '../video/CustomVideoPlayer';
import { Badge, Card, EmptyState } from '../common';
import type { BadgeTone } from '../common';
import './UIUXResultView.css';

export interface UIUXResultViewProps {
  result: UIUXTestStatusResponse;
}

interface ReportCard {
  id: string;
  title: string;
  items: string[];
}

interface EngineResult {
  available?: boolean;
  error?: string;
  violationCount?: number;
}

interface EngineSummary {
  label: string;
  value: string;
  detail: string;
  tone: BadgeTone;
}

const formatStepNumber = (step: number) => String(step).padStart(2, '0');

const formatTimeForDisplay = (time: number) => {
  if (Number.isNaN(time)) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const parseReportCards = (report?: string): ReportCard[] => {
  // 워커가 생성한 마크다운 보고서를 화면용 카드 배열로 가공합니다.
  // 제목 줄은 카드 제목이 되고, 일반 bullet/문장은 해당 카드의 항목으로 들어갑니다.
  const lines = report
    ?.split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines?.length) return [];

  const cards: ReportCard[] = [];
  let currentCard: ReportCard | null = null;

  lines.forEach((line) => {
    const isHeading = line.startsWith('#');
    const normalized = line
      .replace(/^#{1,6}\s*/, '')
      .replace(/^[-*]\s*/, '')
      .replace(/\*\*/g, '')
      .trim();

    if (!normalized) return;

    if (isHeading) {
      currentCard = {
        id: `${cards.length}-${normalized.slice(0, 20)}`,
        title: normalized,
        items: [],
      };
      cards.push(currentCard);
      return;
    }

    if (!currentCard) {
      currentCard = {
        id: `${cards.length}-summary`,
        title: '진단 요약',
        items: [],
      };
      cards.push(currentCard);
    }

    currentCard.items.push(normalized);
  });

  return cards.map((card) => ({
    ...card,
    items: card.items.length ? card.items : ['이번 테스트에서 추가 설명이 감지되지 않았습니다.'],
  }));
};

const getEngineLabel = (source?: string) => {
  switch (source) {
    case 'LIGHTHOUSE':
      return 'Lighthouse';
    case 'AXE':
      return 'axe-core';
    case 'PLAYWRIGHT':
      return 'Playwright';
    case 'UX_RULE':
      return 'UX Rule';
    default:
      return 'Rule';
  }
};

const getScoreGrade = (score?: number) => {
  if (score == null) return '대기';
  if (score >= 90) return '우수';
  if (score >= 75) return '양호';
  if (score >= 60) return '개선 필요';
  return '위험';
};

const toEngineResult = (value: unknown): EngineResult => {
  if (!value || typeof value !== 'object') return {};
  return value as EngineResult;
};

const getEngineSummary = (scoreBreakdown?: Record<string, unknown>): EngineSummary[] => {
  // scoreBreakdown.engineResults에는 Lighthouse/axe-core 실행 성공 여부와 오류 메시지가 들어옵니다.
  // 사용자는 점수만 보면 어떤 엔진이 대체 규칙으로 빠졌는지 알기 어려우므로 별도 요약 카드로 보여줍니다.
  const rawEngineResults = scoreBreakdown?.engineResults;
  const engineResults = rawEngineResults && typeof rawEngineResults === 'object'
    ? rawEngineResults as Record<string, unknown>
    : {};
  const lighthouse = toEngineResult(engineResults.lighthouse);
  const axe = toEngineResult(engineResults.axe);

  return [
    {
      label: 'Lighthouse',
      value: lighthouse.available ? '정상' : '대체 규칙',
      detail: lighthouse.available
        ? '성능, 접근성, 기술 품질 점수를 반영했습니다.'
        : lighthouse.error || '실행 결과가 없습니다.',
      tone: lighthouse.available ? 'success' : 'warning',
    },
    {
      label: 'axe-core',
      value: axe.available ? '정상' : '대체 규칙',
      detail: axe.available
        ? `${axe.violationCount ?? 0}개 접근성 위반을 분석했습니다.`
        : axe.error || '실행 결과가 없습니다.',
      tone: axe.available ? 'success' : 'warning',
    },
  ];
};

const getSeverityTone = (severity?: string): BadgeTone => {
  const normalized = severity?.toLowerCase() || '';
  if (normalized.includes('critical') || normalized.includes('high') || normalized.includes('심각')) return 'danger';
  if (normalized.includes('medium') || normalized.includes('moderate') || normalized.includes('보통')) return 'warning';
  if (normalized.includes('low') || normalized.includes('낮음')) return 'info';
  return 'neutral';
};

export function UIUXResultView({ result }: UIUXResultViewProps) {
  // 완료된 UI/UX 테스트 결과 전용 뷰입니다.
  // 점수 차트, 엔진 상태, 녹화 영상, 결함 타임라인, 마크다운 상세 보고서를 한 화면에서 연결해 보여줍니다.
  const [activeDefectId, setActiveDefectId] = useState<number | null>(null);
  const [showHeuristics, setShowHeuristics] = useState(false);
  const customVideoRef = useRef<CustomVideoPlayerRef>(null);
  const reportDetailsId = `fc-uiux-report-${useId().replace(/:/g, '')}`;
  const reportCards = useMemo(() => parseReportCards(result.report), [result.report]);
  const engineSummary = useMemo(() => getEngineSummary(result.scoreBreakdown), [result.scoreBreakdown]);
  const overallScore = result.scores?.overall;

  const selectDefectAt = useCallback((offset: number) => {
    // 결함 타임라인 항목을 클릭하면 영상 위치도 함께 이동합니다.
    // timestampOffset은 Python 워커가 테스트 시작 시점 기준 초 단위로 계산한 값입니다.
    const targetDefect = result.defects?.find((defect) => defect.timestampOffset === offset);
    setActiveDefectId(targetDefect?.id ?? null);
    customVideoRef.current?.seekTo(offset);
  }, [result.defects]);

  const handleVideoTimeUpdate = useCallback((currentTime: number) => {
    // 영상 재생 위치가 결함 발생 시점과 가까워지면 해당 결함을 강조합니다.
    const currentDefect = result.defects?.find((defect) => Math.abs(defect.timestampOffset - currentTime) < 1);
    setActiveDefectId(currentDefect?.id ?? null);
  }, [result.defects]);

  return (
    <section className="fc-uiux-result" aria-label="UI/UX 테스트 결과">
      {result.scores ? (
        <>
          <div className="fc-uiux-result__summary-grid">
            <Card padding="md" className="fc-uiux-result__overall-card">
              <span className="uiux-eyebrow">Overall</span>
              <div className="fc-uiux-result__overall-score">
                <strong>{overallScore ?? '-'}</strong>
                <span>점</span>
              </div>
              <p>{getScoreGrade(overallScore)} · Lighthouse, axe-core, Playwright 결과를 종합했습니다.</p>
            </Card>

            <Card padding="md" className="fc-uiux-result__engine-card">
              <span className="uiux-eyebrow">Evaluation Engines</span>
              <div className="fc-uiux-result__engine-list">
                {engineSummary.map((engine) => (
                  <div className="fc-uiux-result__engine-item" key={engine.label}>
                    <div>
                      <strong>{engine.label}</strong>
                      <p>{engine.detail}</p>
                    </div>
                    <Badge tone={engine.tone}>{engine.value}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="fc-uiux-result__score-grid">
            <Card padding="md" className="fc-uiux-result__chart-card">
              <UIUXScoreRadarChart scores={result.scores} />
            </Card>
            <Card padding="md" className="fc-uiux-result__chart-card">
              <UIUXScoreBarChart scores={result.scores} />
            </Card>
          </div>
        </>
      ) : (
        <EmptyState title="점수 데이터가 없습니다." description="테스트 점수 산정이 완료되지 않았을 수 있습니다." />
      )}

      <div className="fc-uiux-result__report-grid">
        <section className="fc-uiux-result__video-section">
          <div className="fc-uiux-result__section-heading">
            <span className="uiux-eyebrow">Playback</span>
            <h3>최종 결과 비디오</h3>
          </div>
          <div className="fc-uiux-result__video-frame">
            {result.videoUrl ? (
              <CustomVideoPlayer
                ref={customVideoRef}
                src={result.videoUrl}
                defects={result.defects}
                activeDefectId={activeDefectId}
                onTimeUpdate={handleVideoTimeUpdate}
                onDefectClick={selectDefectAt}
              />
            ) : (
              <EmptyState
                className="fc-uiux-result__video-empty"
                title="비디오 기록 없음"
                description="저장된 최종 결과 영상이 없습니다."
              />
            )}
          </div>
        </section>

        <Card as="aside" padding="md" className="fc-uiux-result__defect-card">
          <div className="fc-uiux-result__section-heading">
            <span className="uiux-eyebrow">Issues</span>
            <h3>결함 타임라인</h3>
          </div>

          {result.defects?.length ? (
            <div className="fc-uiux-result__defect-list">
              {result.defects.map((defect, index) => (
                <button
                  type="button"
                  key={`${defect.id ?? 'defect'}-${index}`}
                  className="fc-uiux-result__defect-item"
                  data-active={activeDefectId != null && activeDefectId === defect.id ? 'true' : undefined}
                  aria-pressed={activeDefectId != null && activeDefectId === defect.id}
                  onClick={() => selectDefectAt(defect.timestampOffset)}
                >
                  <div className="fc-uiux-result__defect-heading">
                    <Badge tone="neutral">{getEngineLabel(defect.source)}</Badge>
                    <strong>{defect.category}</strong>
                  </div>
                  <div className="fc-uiux-result__defect-meta">
                    <Badge tone={getSeverityTone(defect.severity)}>{defect.severity}</Badge>
                    {defect.ruleId && <Badge tone="neutral">{defect.ruleId}</Badge>}
                  </div>
                  <p>{defect.description}</p>
                  {defect.recommendation && <em>{defect.recommendation}</em>}
                  <small>{formatTimeForDisplay(defect.timestampOffset)}</small>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="발견된 결함이 없습니다." description="현재 결과에는 기록된 UI/UX 결함이 없습니다." />
          )}
        </Card>
      </div>

      <Card padding="none" className="fc-uiux-result__report-card">
        <button
          className="fc-uiux-result__report-toggle"
          type="button"
          aria-expanded={showHeuristics}
          aria-controls={reportDetailsId}
          onClick={() => setShowHeuristics((isVisible) => !isVisible)}
        >
          <span>상세 보고서</span>
          <small>{showHeuristics ? '접기' : '펼치기'}</small>
        </button>

        <div
          className="fc-uiux-result__report-details"
          id={reportDetailsId}
          hidden={!showHeuristics}
        >
            {result.scoreBreakdown && (
              <article className="fc-uiux-result__detail-card">
                <div className="fc-uiux-result__detail-index">EV</div>
                <div>
                  <strong>평가 기준 버전 {result.evaluationVersion || 'v1'}</strong>
                  <p>사용성 25%, 접근성 25%, 성능 20%, 탐색 효율 15%, 기술 품질 15% 가중치로 종합 점수를 산정했습니다.</p>
                </div>
              </article>
            )}
            <article className="fc-uiux-result__detail-card">
              <div className="fc-uiux-result__detail-index">EN</div>
              <div>
                <strong>검사 엔진 상태</strong>
                <ul className="fc-uiux-result__detail-list">
                  {engineSummary.map((engine) => (
                    <li key={`engine-${engine.label}`}>{engine.label} {engine.value}: {engine.detail}</li>
                  ))}
                </ul>
              </div>
            </article>
            {reportCards.length ? (
              reportCards.map((card, index) => (
                <article className="fc-uiux-result__detail-card" key={card.id}>
                  <div className="fc-uiux-result__detail-index">{formatStepNumber(index + 1)}</div>
                  <div>
                    <strong>{card.title}</strong>
                    <ul className="fc-uiux-result__detail-list">
                      {card.items.map((item, itemIndex) => (
                        <li key={`${card.id}-${itemIndex}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState title="상세 보고서가 없습니다." description="평가 보고서가 생성되지 않았습니다." />
            )}
        </div>
      </Card>
    </section>
  );
}

export default UIUXResultView;
