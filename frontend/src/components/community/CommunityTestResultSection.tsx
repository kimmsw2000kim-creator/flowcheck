import { useEffect, useState } from 'react';

import type { UIUXTestStatusResponse } from '../../api/UIUXTestApi';
import { fetchCommunityTestResult } from '../../api/communityPostApi';
import type {
    CommunitySharedTestResult,
    SharedUiuxResult,
} from '../../types/communityTestResult';
import EmptyState from '../common/EmptyState';
import LoadTestResultView from '../load/LoadTestResultView';
import UIUXResultView from '../uiux/UIUXResultView';

interface CommunityTestResultSectionProps {
    postId: number;
}

/*
 * 커뮤니티에 공개된 UI/UX 결과를
 * 기존 UIUXResultView의 입력 형태로 변환합니다.
 *
 * 공개하지 않는 URL, 영상, 테스트 단계, 결함 자료는
 * 빈 값으로 전달합니다.
 */
function toUiuxViewResult(
    result: SharedUiuxResult
): UIUXTestStatusResponse {
    return {
        requestId: '',
        status: 'COMPLETED',
        targetUrl: '',
        steps: [],

        report: result.report ?? undefined,

        scores: result.scores
            ? {
                usability: result.scores.usability ?? 0,
                accessibility:
                    result.scores.accessibility ?? 0,
                efficiency: result.scores.efficiency ?? 0,
                performance: result.scores.performance ?? 0,
                bestPractices:
                    result.scores.bestPractices ?? 0,
                overall: result.scores.overall ?? 0,
            }
            : undefined,

        scoreBreakdown:
            result.scoreBreakdown ?? undefined,

        evaluationVersion:
            result.evaluationVersion ?? undefined,

        /*
         * 커뮤니티에는 영상과 결함의 민감한 세부 정보를
         * 공개하지 않습니다.
         */
        videoUrl: undefined,
        defects: [],
    };
}

export default function CommunityTestResultSection({
    postId,
}: CommunityTestResultSectionProps) {
    const [result, setResult] =
        useState<CommunitySharedTestResult | null>(null);

    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        /*
         * 상세 페이지를 벗어난 뒤 API 응답이 도착해도
         * 상태를 변경하지 않도록 처리합니다.
         */
        let cancelled = false;

        const loadResult = async () => {
            try {
                setLoading(true);
                setErrorMessage('');
                setResult(null);

                const response =
                    await fetchCommunityTestResult(postId);

                if (!cancelled) {
                    setResult(response);
                }
            } catch (error: unknown) {
                if (!cancelled) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : '공유된 테스트 결과를 불러오지 못했습니다.';

                    setErrorMessage(message);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadResult();

        return () => {
            cancelled = true;
        };
    }, [postId]);

    if (loading) {
        return (
            <EmptyState
                title="공유된 테스트 결과를 불러오는 중입니다."
                description="잠시만 기다려 주세요."
            />
        );
    }

    if (errorMessage) {
        return (
            <EmptyState
                title={errorMessage}
                description="잠시 후 다시 시도해 주세요."
            />
        );
    }

    if (!result) {
        return (
            <EmptyState
                title="공유된 테스트 결과가 없습니다."
                description="연결된 테스트 결과를 찾을 수 없습니다."
            />
        );
    }

    return (
        <section
            style={{
                display: 'grid',
                gap: '1.5rem',
                marginTop: '2rem',
            }}
        >
            <h2>공유된 테스트 결과</h2>

            {/* 부하 테스트 결과는 기존 결과 컴포넌트를 사용합니다. */}
            {result.testType === 'LOAD' && (
                <LoadTestResultView
                    result={result.loadResult}
                />
            )}

            {/* UI/UX 결과는 공개 가능한 데이터만 변환해서 표시합니다. */}
            {result.testType === 'UIUX' && (
                <UIUXResultView
                    result={toUiuxViewResult(
                        result.uiuxResult
                    )}
                />
            )}
        </section>
    );
}