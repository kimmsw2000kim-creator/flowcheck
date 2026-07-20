import type { LoadTestResult } from './loadTest';

/*
 * 커뮤니티에 공개할 UI/UX 테스트 점수입니다.
 */
export interface SharedUiuxScores {
    usability: number | null;
    accessibility: number | null;
    efficiency: number | null;
    performance: number | null;
    bestPractices: number | null;
    overall: number | null;
}

/*
 * UI/UX 테스트에서 공개 가능한 결과만 포함합니다.
 *
 * 최종 테스트 영상은 포함하지만 대상 URL, 화면 캡처 등의 정보는 제외합니다.
 */
export interface SharedUiuxResult {
    report: string | null;
    videoUrl: string | null;
    scores: SharedUiuxScores | null;
    scoreBreakdown: Record<string, unknown> | null;
    evaluationVersion: string | null;
}

/*
 * 부하 테스트 공유 결과입니다.
 *
 * LOAD일 때는 loadResult만 값을 가지고
 * uiuxResult는 null입니다.
 */
interface CommunitySharedLoadResult {
    testType: 'LOAD';
    loadResult: LoadTestResult;
    uiuxResult: null;
}

/*
 * UI/UX 테스트 공유 결과입니다.
 *
 * UIUX일 때는 uiuxResult만 값을 가지고
 * loadResult는 null입니다.
 */
interface CommunitySharedUiuxResult {
    testType: 'UIUX';
    loadResult: null;
    uiuxResult: SharedUiuxResult;
}

/*
 * testType을 확인하면 TypeScript가
 * 실제 결과 종류를 자동으로 구분할 수 있습니다.
 */
export type CommunitySharedTestResult =
    | CommunitySharedLoadResult
    | CommunitySharedUiuxResult;
