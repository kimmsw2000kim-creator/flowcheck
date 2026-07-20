package com.flowcheck.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowcheck.config.RestClientConfig;
import com.flowcheck.domain.TestRequest;
import com.flowcheck.dto.LoadTest.LoadTestProgressUpdateRequest;
import com.flowcheck.dto.LoadTest.LoadTestRequest;
import com.flowcheck.dto.LoadTest.LoadTestSubmittedEvent;
import com.flowcheck.repository.LoadTestReportRepository;
import com.flowcheck.repository.TestRequestRepository;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClient;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AsyncLoadTestWorkerTest {

    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void marksRequestTimedOutWhenFastApiDoesNotRespondInTime() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/load-tests", exchange -> {
            try {
                Thread.sleep(500);
                byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            } finally {
                exchange.close();
            }
        });
        server.start();

        RestClient restClient = new RestClientConfig().loadTestRestClient(
                RestClient.builder(), 1_000, 50);
        TestRequestRepository requestRepository = mock(TestRequestRepository.class);
        LoadTestReportRepository reportRepository = mock(LoadTestReportRepository.class);
        LoadTestStreamService streamService = mock(LoadTestStreamService.class);
        AsyncLoadTestWorker worker = new AsyncLoadTestWorker(
                requestRepository,
                reportRepository,
                streamService,
                restClient,
                new ObjectMapper());
        ReflectionTestUtils.setField(
                worker,
                "fastApiUrl",
                "http://127.0.0.1:" + server.getAddress().getPort());

        UUID requestId = UUID.randomUUID();
        TestRequest testHistory = TestRequest.builder()
                .targetUrl("https://example.com")
                .promptInput("")
                .testType("LOAD")
                .testStatus("PENDING")
                .testPhase("QUEUED")
                .testProgress(0)
                .build();
        when(requestRepository.findById(requestId)).thenReturn(Optional.of(testHistory));

        LoadTestRequest request = new LoadTestRequest();
        request.setTargetUrl("https://example.com");
        request.setVusers(1);
        request.setDuration(10);

        worker.executeTestAsync(new LoadTestSubmittedEvent(requestId, request));

        ArgumentCaptor<LoadTestProgressUpdateRequest> updateCaptor =
                ArgumentCaptor.forClass(LoadTestProgressUpdateRequest.class);
        verify(streamService, atLeastOnce()).updateProgress(
                org.mockito.ArgumentMatchers.eq(requestId),
                updateCaptor.capture());
        assertThat(updateCaptor.getAllValues())
                .anySatisfy(update -> {
                    assertThat(update.status()).isEqualTo("FAILED");
                    assertThat(update.phase()).isEqualTo("TIMEOUT");
                    assertThat(update.progress()).isEqualTo(100);
                });
    }

    @ParameterizedTest
    @ValueSource(ints = {424, 500})
    void routesFastApiErrorsThroughCommonFailedProgressUpdate(int statusCode) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/load-tests", exchange -> {
            byte[] body = "{\"detail\":\"load test failed\"}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(statusCode, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();

        RestClient restClient = new RestClientConfig().loadTestRestClient(
                RestClient.builder(), 1_000, 1_000);
        TestRequestRepository requestRepository = mock(TestRequestRepository.class);
        LoadTestReportRepository reportRepository = mock(LoadTestReportRepository.class);
        LoadTestStreamService streamService = mock(LoadTestStreamService.class);
        AsyncLoadTestWorker worker = new AsyncLoadTestWorker(
                requestRepository,
                reportRepository,
                streamService,
                restClient,
                new ObjectMapper());
        ReflectionTestUtils.setField(
                worker,
                "fastApiUrl",
                "http://127.0.0.1:" + server.getAddress().getPort());

        UUID requestId = UUID.randomUUID();
        TestRequest testHistory = TestRequest.builder()
                .targetUrl("https://example.com")
                .promptInput("")
                .testType("LOAD")
                .testStatus("PENDING")
                .testPhase("QUEUED")
                .testProgress(0)
                .build();
        when(requestRepository.findById(requestId)).thenReturn(Optional.of(testHistory));

        LoadTestRequest request = new LoadTestRequest();
        request.setTargetUrl("https://example.com");
        request.setVusers(1);
        request.setDuration(10);

        worker.executeTestAsync(new LoadTestSubmittedEvent(requestId, request));

        ArgumentCaptor<LoadTestProgressUpdateRequest> updateCaptor =
                ArgumentCaptor.forClass(LoadTestProgressUpdateRequest.class);
        verify(streamService, atLeastOnce()).updateProgress(
                org.mockito.ArgumentMatchers.eq(requestId),
                updateCaptor.capture());
        assertThat(updateCaptor.getAllValues())
                .anySatisfy(update -> {
                    assertThat(update.status()).isEqualTo("FAILED");
                    assertThat(update.phase()).isEqualTo("FAILED");
                    assertThat(update.progress()).isEqualTo(100);
                });
        verify(requestRepository, times(1)).save(testHistory);
    }
}
