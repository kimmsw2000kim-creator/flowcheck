import { useCallback, useMemo, useRef, useState } from 'react';
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

interface ReportItemGroup {
  category: string;
  items: string[];
}

const CATEGORY_ORDER = ['USABILITY', 'ACCESSIBILITY', 'EFFICIENCY', 'PERFORMANCE', 'BEST_PRACTICES'];

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

const getCategoryLabel = (category?: string) => {
  switch (category) {
    case 'USABILITY':
      return '사용성';
    case 'ACCESSIBILITY':
      return '접근성';
    case 'EFFICIENCY':
      return '탐색 효율';
    case 'PERFORMANCE':
      return '성능';
    case 'BEST_PRACTICES':
      return '기술 품질';
    default:
      return category || '품질';
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

const getReportItemsByTitle = (cards: ReportCard[], pattern: RegExp) =>
  cards
    .filter((card) => pattern.test(card.title))
    .flatMap((card) => card.items);

const groupReportItems = (
  items: string[],
  fallbackCategory: string,
  maxItemsPerGroup = 6,
): ReportItemGroup[] => {
  const grouped = new Map<string, string[]>();
  items.forEach((item) => {
    const categoryMatch = item.match(/^([^:：]{1,20})[:：]\s*(.+)$/);
    const category = categoryMatch?.[1]?.trim() || fallbackCategory;
    const text = categoryMatch?.[2]?.trim() || item;
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)?.push(text);
  });

  return Array.from(grouped.entries()).map(([category, groupItems]) => ({
    category,
    items: groupItems.slice(0, maxItemsPerGroup),
  }));
};

const groupDefectItems = (
  defects: UIUXTestStatusResponse['defects'],
  getItemText: (defect: NonNullable<UIUXTestStatusResponse['defects']>[number]) => string | undefined,
): ReportItemGroup[] => {
  const grouped = new Map<string, string[]>();
  defects?.forEach((defect) => {
    const text = getItemText(defect)?.trim();
    if (!text) return;

    const category = getCategoryLabel(defect.category);
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)?.push(text);
  });

  const categoryRank = (category: string) => {
    const rawCategory = Object.fromEntries(CATEGORY_ORDER.map((key) => [getCategoryLabel(key), key]))[category];
    const rank = CATEGORY_ORDER.indexOf(rawCategory);
    return rank === -1 ? CATEGORY_ORDER.length : rank;
  };

  return Array.from(grouped.entries())
    .sort(([a], [b]) => categoryRank(a) - categoryRank(b))
    .map(([category, items]) => ({
      category,
      items: Array.from(new Set(items)).slice(0, 6),
    }));
};

export function UIUXResultView({ result }: UIUXResultViewProps) {
  // 완료된 UI/UX 테스트 결과 전용 뷰입니다.
  // 점수 차트, 엔진 상태, 녹화 영상, 결함 타임라인, 마크다운 상세 보고서를 한 화면에서 연결해 보여줍니다.
  const [activeDefectId, setActiveDefectId] = useState<number | null>(null);
  const customVideoRef = useRef<CustomVideoPlayerRef>(null);
  const reportCards = useMemo(() => parseReportCards(result.report), [result.report]);
  const engineSummary = useMemo(() => getEngineSummary(result.scoreBreakdown), [result.scoreBreakdown]);
  const overallScore = result.scores?.overall;
  const reportImprovementItems = useMemo(
    () => getReportItemsByTitle(reportCards, /개선|문제|결함|권장|진단/),
    [reportCards],
  );
  const reportCriteriaItems = useMemo(
    () => getReportItemsByTitle(reportCards, /평가|기준|버전/),
    [reportCards],
  );
  const fixTargetGroups = useMemo(() => {
    const defectGroups = groupDefectItems(result.defects, (defect) => defect.description);

    if (defectGroups.length) return defectGroups;
    if (reportImprovementItems.length) return groupReportItems(reportImprovementItems, '수정 필요 항목');
    return [{ category: '수정 필요 항목', items: ['이번 테스트에서 우선 수정이 필요한 항목이 별도로 기록되지 않았습니다.'] }];
  }, [reportImprovementItems, result.defects]);
  const fixActionGroups = useMemo(() => {
    const recommendationGroups = groupDefectItems(result.defects, (defect) => defect.recommendation);

    if (recommendationGroups.length) return recommendationGroups;

    const directionItems = reportImprovementItems
      .filter((item) => /개선 방향|권장|하세요|필요|제공|추가|수정/.test(item))
      .slice(0, 6);

    if (directionItems.length) return groupReportItems(directionItems, '개선 방향');
    return [{ category: '개선 방향', items: ['결함 타임라인과 최종 결과 영상을 함께 확인해 사용자가 막히는 지점을 먼저 수정하세요.'] }];
  }, [reportImprovementItems, result.defects]);
  const criteriaItems = useMemo(() => {
    const baseCriteria = [
      '사용성 25%, 접근성 25%, 성능 20%, 탐색 효율 15%, 기술 품질 15% 가중치로 종합 점수를 산정했습니다.',
      'Lighthouse, axe-core, Playwright 기반 검사와 브라우저 DOM 규칙을 함께 반영했습니다.',
    ];

    return [
      ...baseCriteria,
      ...reportCriteriaItems
        .filter((item) => !baseCriteria.includes(item) && !/버전|version/i.test(item))
        .slice(0, 3),
    ];
  }, [reportCriteriaItems]);
  const criteriaRows = useMemo(
    () => criteriaItems.map((item, index) => ({
      category: index === 0 ? '점수 산정' : index === 1 ? '검사 도구' : '참고 기준',
      item,
    })),
    [criteriaItems],
  );

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
        <div className="fc-uiux-result__report-header">
          <span>상세 보고서</span>
        </div>

        <div className="fc-uiux-result__report-details">
          <article className="fc-uiux-result__detail-card">
            <div className="fc-uiux-result__detail-card-head">
              <div className="fc-uiux-result__detail-title">
                <strong>수정 필요 항목</strong>
                <p>테스트 중 확인된 품질 저하 요인을 분류별로 정리했습니다.</p>
              </div>
              <Badge tone="warning">{fixTargetGroups.reduce((sum, group) => sum + group.items.length, 0)}건</Badge>
            </div>
            <div className="fc-uiux-result__report-groups" aria-label="수정 필요 항목">
              {fixTargetGroups.map((group) => (
                <section className="fc-uiux-result__report-group" key={`fix-target-${group.category}`}>
                  <h4>{group.category}</h4>
                  <div className="fc-uiux-result__report-group-list">
                    {group.items.map((item, index) => (
                      <p key={`fix-target-${group.category}-${index}`}>{item}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </article>

          <article className="fc-uiux-result__detail-card">
            <div className="fc-uiux-result__detail-card-head">
              <div className="fc-uiux-result__detail-title">
                <strong>개선 방향</strong>
                <p>동일 패턴은 묶어서 수정하고, 사용자 행동을 막는 항목부터 우선 처리합니다.</p>
              </div>
              <Badge tone="info">{fixActionGroups.reduce((sum, group) => sum + group.items.length, 0)}건</Badge>
            </div>
            <div className="fc-uiux-result__report-groups" aria-label="개선 방향">
              {fixActionGroups.map((group) => (
                <section className="fc-uiux-result__report-group" key={`fix-action-${group.category}`}>
                  <h4>{group.category}</h4>
                  <div className="fc-uiux-result__report-group-list">
                    {group.items.map((item, index) => (
                      <p key={`fix-action-${group.category}-${index}`}>{item}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </article>

          <article className="fc-uiux-result__detail-card">
            <div className="fc-uiux-result__detail-card-head">
              <div className="fc-uiux-result__detail-title">
                <strong>평가 기준</strong>
                <p>점수는 정해진 가중치와 브라우저 기반 검사 결과로 산정됩니다.</p>
              </div>
              <Badge tone="neutral">기준</Badge>
            </div>
            <div className="fc-uiux-result__report-table" role="table" aria-label="평가 기준">
              <div className="fc-uiux-result__report-table-head" role="row">
                <span role="columnheader">항목</span>
                <span role="columnheader">기준</span>
              </div>
              {criteriaRows.map((row, index) => (
                <div className="fc-uiux-result__report-table-row" role="row" key={`criteria-${index}`}>
                  <span className="fc-uiux-result__report-table-category" role="cell">{row.category}</span>
                  <span className="fc-uiux-result__report-table-text" role="cell">{row.item}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </Card>
    </section>
  );
}

export default UIUXResultView;
