package com.flowcheck.dto.community;

import com.flowcheck.dto.LoadTest.LoadTestResponse;
import com.flowcheck.dto.uiuxtest.UIUXTestStatusResponse;

import java.util.Map;

/*
 * 커뮤니티에 공유된 테스트 결과 응답입니다.
 *
 * 테스트 종류에 따라 loadResult 또는 uiuxResult 중
 * 하나만 값을 가지고 나머지는 null이 됩니다.
 */
public record CommunitySharedTestResultResponse(
        String testType,
        LoadTestResponse.TestResults loadResult,
        SharedUiuxResult uiuxResult
) {

    /*
     * 부하 테스트 공유 결과를 생성합니다.
     */
    public static CommunitySharedTestResultResponse load(
            LoadTestResponse.TestResults result
    ) {
        return new CommunitySharedTestResultResponse(
                "LOAD",
                result,
                null
        );
    }

    /*
     * UI/UX 테스트 공유 결과를 생성합니다.
     */
    public static CommunitySharedTestResultResponse uiux(
            SharedUiuxResult result
    ) {
        return new CommunitySharedTestResultResponse(
                "UIUX",
                null,
                result
        );
    }

    /*
     * UI/UX 결과에서 커뮤니티에 공개할 정보만 담습니다.
     *
     * 공유에 동의한 최종 테스트 영상은 포함하되 대상 URL,
     * 입력 프롬프트, 화면 캡처, DOM 선택자 등은 제외합니다.
     */
    public record SharedUiuxResult(
            String report,
            String videoUrl,
            UIUXTestStatusResponse.ScoresDto scores,
            Map<String, Object> scoreBreakdown,
            String evaluationVersion
    ) {
    }
}
