package com.flowcheck.config;

import io.netty.handler.ssl.SslContext;
import io.netty.handler.ssl.SslContextBuilder;
import io.netty.handler.ssl.util.InsecureTrustManagerFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

@Slf4j
@Configuration
public class WebClientConfig {

    @Value("${http-client.ssl.trust-all:true}")
    private boolean trustAllSslCertificates;

    @Bean
    public WebClient webClient(WebClient.Builder builder) {
        if (!trustAllSslCertificates) {
            return builder.build();
        }

        try {
            SslContext sslContext = SslContextBuilder.forClient()
                    .trustManager(InsecureTrustManagerFactory.INSTANCE)
                    .build();
            HttpClient httpClient = HttpClient.create()
                    .secure(sslSpec -> sslSpec.sslContext(sslContext));

            log.warn("HTTP client SSL certificate validation is disabled for WebClient.");
            return builder
                    .clientConnector(new ReactorClientHttpConnector(httpClient))
                    .build();
        } catch (Exception e) {
            log.warn("Failed to create trust-all WebClient. Falling back to default SSL validation.", e);
            return builder.build();
        }
    }
}
