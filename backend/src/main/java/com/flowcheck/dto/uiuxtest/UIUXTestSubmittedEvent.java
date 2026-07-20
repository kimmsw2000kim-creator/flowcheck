package com.flowcheck.dto.uiuxtest;

import java.util.UUID;

// UIUXTestService가 테스트 요청을 DB에 저장한 뒤 발행하는 도메인 이벤트입니다.
// AsyncUIUXTestWorker는 이 이벤트를 AFTER_COMMIT 시점에 받아 FastAPI로 실행을 전달합니다.
public record UIUXTestSubmittedEvent(UUID requestId, UIUXTestStartRequest request) {
}
