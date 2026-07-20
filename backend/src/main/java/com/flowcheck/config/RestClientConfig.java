package com.flowcheck.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.net.http.HttpClient;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.time.Duration;

@Slf4j
@Configuration
public class RestClientConfig {

    @Value("${http-client.ssl.trust-all:true}")
    private boolean trustAllSslCertificates;

    @Bean
    @Primary
    public RestClient customRestClient(
            RestClient.Builder builder,
            @Value("${http-client.connect-timeout-ms:5000}") long connectTimeoutMs,
            @Value("${http-client.default-read-timeout-ms:60000}") long readTimeoutMs) {
        return buildRestClient(builder, connectTimeoutMs, readTimeoutMs);
    }

    @Bean("loadTestRestClient")
    public RestClient loadTestRestClient(
            RestClient.Builder builder,
            @Value("${http-client.connect-timeout-ms:5000}") long connectTimeoutMs,
            @Value("${http-client.load-test-read-timeout-ms:900000}") long readTimeoutMs) {
        return buildRestClient(builder, connectTimeoutMs, readTimeoutMs);
    }

    private RestClient buildRestClient(
            RestClient.Builder builder,
            long connectTimeoutMs,
            long readTimeoutMs) {
        Duration connectTimeout = positiveDuration(connectTimeoutMs, "connectTimeoutMs");
        Duration readTimeout = positiveDuration(readTimeoutMs, "readTimeoutMs");

        HttpClient.Builder httpClientBuilder = HttpClient.newBuilder()
                .connectTimeout(connectTimeout)
                .version(HttpClient.Version.HTTP_1_1);

        if (trustAllSslCertificates) {
            applyTrustAllSsl(httpClientBuilder);
        }

        JdkClientHttpRequestFactory requestFactory =
                new JdkClientHttpRequestFactory(httpClientBuilder.build());
        requestFactory.setReadTimeout(readTimeout);

        return builder
                .requestFactory(requestFactory)
                .build();
    }

    private void applyTrustAllSsl(HttpClient.Builder httpClientBuilder) {
        try {
            TrustManager[] trustAllCerts = new TrustManager[]{
                    new X509TrustManager() {
                        @Override
                        public X509Certificate[] getAcceptedIssuers() {
                            return new X509Certificate[0];
                        }

                        @Override
                        public void checkClientTrusted(X509Certificate[] certs, String authType) {
                        }

                        @Override
                        public void checkServerTrusted(X509Certificate[] certs, String authType) {
                        }
                    }
            };

            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, trustAllCerts, new SecureRandom());
            httpClientBuilder.sslContext(sslContext);
            log.warn("HTTP client SSL certificate validation is disabled for RestClient.");
        } catch (Exception e) {
            log.warn("Failed to initialize trust-all SSL context; using the platform SSL context.", e);
        }
    }

    private Duration positiveDuration(long milliseconds, String propertyName) {
        if (milliseconds <= 0) {
            throw new IllegalArgumentException(propertyName + " must be greater than zero");
        }
        return Duration.ofMillis(milliseconds);
    }
}
