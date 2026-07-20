package com.flowcheck.service;

import com.flowcheck.domain.TestRequest;
import com.flowcheck.dto.LoadTest.LoadTestProgressUpdateRequest;
import com.flowcheck.repository.TestRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LoadTestStreamServiceTest {

    private TestRequestRepository repository;
    private LoadTestStreamService service;
    private UUID userId;
    private UUID requestId;

    @BeforeEach
    void setUp() {
        repository = mock(TestRequestRepository.class);
        service = new LoadTestStreamService(repository);
        userId = UUID.randomUUID();
        requestId = UUID.randomUUID();
    }

    @Test
    void keepsMultipleSubscribersForSameRequest() {
        TestRequest request = activeRequest();
        when(repository.findByIdAndUser_UserIdAndTestType(requestId, userId, "LOAD"))
                .thenReturn(Optional.of(request));

        SseEmitter first = service.register(userId, requestId);
        service.register(userId, requestId);

        assertThat(service.emitterCount(requestId)).isEqualTo(2);

        service.removeEmitter(requestId, first);

        assertThat(service.emitterCount(requestId)).isEqualTo(1);
    }

    @Test
    void completesAndRemovesAllSubscribersAtTerminalUpdate() {
        TestRequest request = activeRequest();
        when(repository.findByIdAndUser_UserIdAndTestType(requestId, userId, "LOAD"))
                .thenReturn(Optional.of(request));
        when(repository.findById(requestId)).thenReturn(Optional.of(request));
        service.register(userId, requestId);
        service.register(userId, requestId);

        service.updateProgress(requestId, new LoadTestProgressUpdateRequest(
                "COMPLETED", "COMPLETED", 100, "done"));

        assertThat(service.emitterCount(requestId)).isZero();
        assertThat(request.getTestStatus()).isEqualTo("COMPLETED");
    }

    @Test
    void doesNotStoreSubscriberForAlreadyTerminalRequest() {
        TestRequest request = terminalRequest("FAILED");
        when(repository.findByIdAndUser_UserIdAndTestType(requestId, userId, "LOAD"))
                .thenReturn(Optional.of(request));

        service.register(userId, requestId);

        assertThat(service.emitterCount(requestId)).isZero();
    }

    @Test
    void ignoresNonTerminalProgressAfterTerminalState() {
        TestRequest request = terminalRequest("FAILED");
        when(repository.findById(requestId)).thenReturn(Optional.of(request));

        service.updateProgress(requestId, new LoadTestProgressUpdateRequest(
                "RUNNING", "PROCESSING_RESULTS", 80, "late"));

        assertThat(request.getTestStatus()).isEqualTo("FAILED");
        verify(repository, never()).save(request);
    }

    private TestRequest activeRequest() {
        return TestRequest.builder()
                .targetUrl("https://example.com")
                .promptInput("")
                .testType("LOAD")
                .testStatus("RUNNING")
                .testPhase("DISPATCHED_TO_FASTAPI")
                .testProgress(15)
                .build();
    }

    private TestRequest terminalRequest(String status) {
        TestRequest request = activeRequest();
        request.changeStatus(status);
        request.changePhase(status);
        request.changeProgress(100);
        return request;
    }
}
