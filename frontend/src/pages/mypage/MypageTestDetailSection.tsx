import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

import apiClient from '../../api/client';
import { fetchMypageUIUXTestDetail } from '../../api/mypageApi';
import type { UIUXTestStatusResponse } from '../../api/UIUXTestApi';
import CustomVideoPlayer, { type CustomVideoPlayerRef } from '../../components/video/CustomVideoPlayer';
import UIUXScoreRadarChart from '../../components/dashboard/UIUXScoreRadarChart';
import UIUXScoreBarChart from '../../components/dashboard/UIUXScoreBarChart';
import EmptyState from '../../components/common/EmptyState';
import '../../styles/UIUXTestPage.css';

interface LoadChartDataPoint {
    time: string;
    tps: number;
    avgResponse: number;
}

interface LoadTestDetail {
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

const formatStepNumber = (step: number) => String(step).padStart(2, '0');

const formatTimeForDisplay = (time: number) => {
    if (Number.isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const parseReportCards = (report?: string) => {
    const lines = report
        ?.split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    if (!lines?.length) return [];

    const cards: Array<{ id: string; title: string; items: string[] }> = [];
    let currentCard: { id: string; title: string; items: string[] } | null = null;

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

const getDefectCategoryLabel = (category?: string) => {
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
            return '품질';
    }
};

const getDefectSeverityLabel = (severity?: string) => {
    switch (severity) {
        case 'CRITICAL':
            return '긴급';
        case 'MAJOR':
            return '중요';
        case 'MINOR':
            return '경미';
        default:
            return '확인 필요';
    }
};

const getScoreGrade = (score?: number) => {
    if (score == null) return '대기';
    if (score >= 90) return '우수';
    if (score >= 75) return '양호';
    if (score >= 60) return '개선 필요';
    return '위험';
};

const getEngineSummary = (scoreBreakdown?: Record<string, unknown>) => {
    const engineResults = scoreBreakdown?.engineResults as Record<string, any> | undefined;
    const lighthouse = engineResults?.lighthouse;
    const axe = engineResults?.axe;

    return [
        {
            label: 'Lighthouse',
            value: lighthouse?.available ? '정상' : '대체 규칙',
            detail: lighthouse?.available ? '성능, 접근성, 기술 품질 점수를 반영했습니다.' : lighthouse?.error || '실행 결과가 없습니다.',
        },
        {
            label: 'axe-core',
            value: axe?.available ? '정상' : '대체 규칙',
            detail: axe?.available ? `${axe?.violationCount ?? 0}개 접근성 위반을 분석했습니다.` : axe?.error || '실행 결과가 없습니다.',
        },
    ];
};

const summarizeEngineFallback = (error?: string) => {
    if (!error) {
        return '분석 도구 결과를 가져오지 못해 브라우저 기반 대체 규칙으로 평가했습니다.';
    }

    if (/Command|returned non-zero exit status|node_modules|lighthouse\/cli|subprocess/i.test(error)) {
        return '분석 도구 실행이 완료되지 않아 브라우저 기반 대체 규칙으로 평가했습니다.';
    }

    if (/timeout|timed out/i.test(error)) {
        return '분석 도구 실행 시간이 초과되어 브라우저 기반 대체 규칙으로 평가했습니다.';
    }

    return '분석 도구 결과를 사용할 수 없어 브라우저 기반 대체 규칙으로 평가했습니다.';
};

function MypageTestDetailSection() {
    const { testType, requestId } = useParams<{ testType: string; requestId: string }>();
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const [loadDetail, setLoadDetail] = useState<LoadTestDetail | null>(null);
    const [uiuxDetail, setUiuxDetail] = useState<UIUXTestStatusResponse | null>(null);
    const [activeDefectId, setActiveDefectId] = useState<number | null>(null);
    const customVideoRef = useRef<CustomVideoPlayerRef>(null);

    const isUIUXTest = testType === 'UI' || testType === 'UIUX';

    useEffect(() => {
        if (!requestId || !testType) return;

        setLoading(true);
        setErrorMessage('');
        setLoadDetail(null);
        setUiuxDetail(null);

        if (testType === 'LOAD') {
            apiClient.get(`/api/load-tests/${requestId}`)
                .then((res) => {
                    setLoadDetail(res.data.testResults ?? null);
                })
                .catch(() => setErrorMessage('부하 테스트 결과를 불러오지 못했습니다.'))
                .finally(() => setLoading(false));
            return;
        }

        if (isUIUXTest) {
            fetchMypageUIUXTestDetail(requestId)
                .then((res) => setUiuxDetail(res))
                .catch((error) => setErrorMessage(error.message || 'UI/UX 테스트 결과를 불러오지 못했습니다.'))
                .finally(() => setLoading(false));
            return;
        }

        setErrorMessage('지원하지 않는 테스트 유형입니다.');
        setLoading(false);
    }, [isUIUXTest, requestId, testType]);

    const reportCards = useMemo(() => parseReportCards(uiuxDetail?.report), [uiuxDetail?.report]);
    const engineSummary = useMemo(() => getEngineSummary(uiuxDetail?.scoreBreakdown), [uiuxDetail?.scoreBreakdown]);
    const overallScore = uiuxDetail?.scores?.overall;

    const handleVideoTimeUpdate = (currentTime: number) => {
        if (!uiuxDetail?.defects) return;
        const currentDefect = uiuxDetail.defects.find((defect) => Math.abs(defect.timestampOffset - currentTime) < 1);
        setActiveDefectId(currentDefect?.id || null);
    };

    const handleDefectClick = (offset: number) => {
        const targetDefect = uiuxDetail?.defects?.find((defect) => defect.timestampOffset === offset);
        setActiveDefectId(targetDefect?.id || null);
        customVideoRef.current?.seekTo(offset);
    };

    if (loading) {
        return <EmptyState title="결과를 불러오는 중입니다." description="잠시만 기다려 주세요." />;
    }

    if (errorMessage) {
        return <EmptyState title={errorMessage} description="목록으로 돌아가 다시 시도해 주세요." />;
    }

    if (testType === 'LOAD') {
        if (!loadDetail) {
            return <EmptyState title="결과 데이터가 없습니다." description="테스트가 아직 완료되지 않았을 수 있습니다." />;
        }

        return (
            <div className="card">
                <h2>부하 테스트 상세 결과</h2>
                <div className={`report-markdown load-report-markdown grade-${loadDetail.performanceGrade?.toLowerCase() ?? 'unknown'}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{loadDetail.bottleneckComment}</ReactMarkdown>
                </div>

                <div style={{ height: '320px', width: '100%', marginTop: '1.5rem' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={loadDetail.points}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="time" stroke="var(--text-muted)" />
                            <YAxis stroke="var(--accent)" />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="tps" name="TPS" stroke="var(--accent)" />
                            <Line type="monotone" dataKey="avgResponse" name="평균 응답시간(ms)" stroke="var(--success)" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    if (!uiuxDetail) {
        return <EmptyState title="UI/UX 테스트 결과가 없습니다." description="테스트가 아직 완료되지 않았을 수 있습니다." />;
    }

    return (
        <section className="uiux-page">
            <header className="uiux-header">
                <div>
                    <h2>UI/UX 테스트 상세 결과</h2>
                    <p>{uiuxDetail.targetUrl}</p>
                </div>
            </header>

            {uiuxDetail.scores && (
                <>
                    <div className="uiux-summary-grid">
                        <div className="uiux-card uiux-overall-card">
                            <span className="uiux-eyebrow">Overall</span>
                            <div>
                                <strong>{overallScore ?? '-'}</strong>
                                <span>점</span>
                            </div>
                            <p>{getScoreGrade(overallScore)} · Lighthouse, axe-core, Playwright 결과를 종합했습니다.</p>
                        </div>

                        <div className="uiux-card uiux-engine-card">
                            <span className="uiux-eyebrow">분석 도구 상태</span>
                            <div className="uiux-engine-list">
                                {engineSummary.map((engine) => (
                                    <div className="uiux-engine-item" key={engine.label}>
                                        <div>
                                            <strong>{engine.label}</strong>
                                            <p>{engine.detail}</p>
                                        </div>
                                        <span>{engine.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="uiux-score-grid">
                        <div className="uiux-card uiux-chart-card">
                            <UIUXScoreRadarChart scores={uiuxDetail.scores} />
                        </div>
                        <div className="uiux-card uiux-chart-card">
                            <UIUXScoreBarChart scores={uiuxDetail.scores} />
                        </div>
                    </div>
                </>
            )}

            <div className="uiux-report-grid">
                <div className="uiux-card uiux-report-video-card">
                    <div className="uiux-video-titlebar">
                        <div>
                            <span className="uiux-eyebrow">Playback</span>
                            <h3>최종 결과 비디오</h3>
                        </div>
                    </div>
                    <div className="uiux-youtube-frame">
                        {uiuxDetail.videoUrl ? (
                            <CustomVideoPlayer
                                ref={customVideoRef}
                                src={uiuxDetail.videoUrl}
                                defects={uiuxDetail.defects}
                                activeDefectId={activeDefectId}
                                onTimeUpdate={handleVideoTimeUpdate}
                                onDefectClick={handleDefectClick}
                            />
                        ) : (
                            <div className="uiux-player-idle">
                                <strong>비디오 기록 없음</strong>
                                <p>저장된 최종 결과 영상이 없습니다.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="uiux-card uiux-defect-card">
                    <div className="uiux-card-header compact">
                        <div>
                            <span className="uiux-eyebrow">Issues</span>
                            <h3>결함 타임라인</h3>
                        </div>
                    </div>

                    <div className="uiux-defect-list">
                        {uiuxDetail.defects && uiuxDetail.defects.length > 0 ? (
                            uiuxDetail.defects.map((defect) => (
                                <button
                                    type="button"
                                    key={defect.id}
                                    className={`uiux-defect-item ${activeDefectId === defect.id ? 'active' : ''}`}
                                    onClick={() => handleDefectClick(defect.timestampOffset)}
                                >
                                    <div>
                                        <span>{getEngineLabel(defect.source)}</span>
                                        <strong>{getDefectCategoryLabel(defect.category)}</strong>
                                    </div>
                                    <div className="uiux-defect-meta">
                                        <span>{getDefectSeverityLabel(defect.severity)}</span>
                                        {defect.ruleId && <span>{defect.ruleId}</span>}
                                    </div>
                                    <p>{defect.description}</p>
                                    {defect.recommendation && <em>{defect.recommendation}</em>}
                                    <small>{formatTimeForDisplay(defect.timestampOffset)}</small>
                                </button>
                            ))
                        ) : (
                            <div className="uiux-empty-steps">
                                <p>발견된 결함이 없습니다.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="uiux-card uiux-report-card">
                <div className="uiux-report-toggle">
                    <span>상세 보고서</span>
                    <small>{uiuxDetail.evaluationVersion || 'v1'}</small>
                </div>

                <div className="uiux-report-details">
                    {uiuxDetail.scoreBreakdown && (
                        <article className="uiux-report-detail-card">
                            <div className="uiux-report-detail-index">EV</div>
                            <div>
                                <strong>평가 기준 버전 {uiuxDetail.evaluationVersion || 'v1'}</strong>
                                <p>사용성 25%, 접근성 25%, 성능 20%, 탐색 효율 15%, 기술 품질 15% 가중치로 종합 점수를 산정했습니다.</p>
                            </div>
                        </article>
                    )}
                    <article className="uiux-report-detail-card">
                        <div className="uiux-report-detail-index">EN</div>
                        <div>
                            <strong>분석 도구 상태</strong>
                            <ul className="uiux-report-detail-list">
                                {engineSummary.map((engine) => (
                                    <li key={`engine-${engine.label}`}>{engine.label} {engine.value}: {engine.detail}</li>
                                ))}
                            </ul>
                        </div>
                    </article>
                    {reportCards.length > 0 ? (
                        reportCards.map((card, index) => (
                            <article className="uiux-report-detail-card" key={card.id}>
                                <div className="uiux-report-detail-index">{formatStepNumber(index + 1)}</div>
                                <div>
                                    <strong>{card.title}</strong>
                                    <ul className="uiux-report-detail-list">
                                        {card.items.map((item, itemIndex) => (
                                            <li key={`${card.id}-${itemIndex}`}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            </article>
                        ))
                    ) : (
                        <p>상세 보고서가 없습니다.</p>
                    )}
                </div>
            </div>
        </section>
    );
}

export default MypageTestDetailSection;
