import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

import apiClient from '../../api/client';
import { fetchMypageUIUXTestDetail } from '../../api/mypageApi';
import type { UIUXTestStatusResponse } from '../../api/UIUXTestApi';
import { EmptyState, PageHeader } from '../../components/common';
import { UIUXResultView } from '../../components/uiux';

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

function MypageTestDetailSection() {
    const { testType, requestId } = useParams<{ testType: string; requestId: string }>();
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const [loadDetail, setLoadDetail] = useState<LoadTestDetail | null>(null);
    const [uiuxDetail, setUiuxDetail] = useState<UIUXTestStatusResponse | null>(null);

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
        <section className="mypage-uiux-detail">
            <PageHeader
                headingLevel={2}
                title="UI/UX 테스트 상세 결과"
                description={uiuxDetail.targetUrl}
            />
            <UIUXResultView result={uiuxDetail} />
        </section>
    );
}

export default MypageTestDetailSection;
