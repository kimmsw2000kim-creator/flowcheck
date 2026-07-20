package com.flowcheck.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.net.http.HttpClient;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;

@Slf4j
@Configuration
public class RestClientConfig {

    @Value("${http-client.ssl.trust-all:true}")
    private boolean trustAllSslCertificates;

    @Bean
    public RestClient customRestClient(RestClient.Builder builder) {
        if (!trustAllSslCertificates) {
            return builder.build();
        }

        try {
            TrustManager[] trustAllCerts = new TrustManager[]{
                    new X509TrustManager() {
                        public X509Certificate[] getAcceptedIssuers() {
                            return new X509Certificate[0];
                        }

                        public void checkClientTrusted(X509Certificate[] certs, String authType) {
                        }

                        public void checkServerTrusted(X509Certificate[] certs, String authType) {
                        }
                    }
            };

            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, trustAllCerts, new SecureRandom());

            HttpClient httpClient = HttpClient.newBuilder()
                    .sslContext(sslContext)
                    .version(HttpClient.Version.HTTP_1_1)
                    .build();

            log.warn("HTTP client SSL certificate validation is disabled for RestClient.");
            return builder
                    .requestFactory(new JdkClientHttpRequestFactory(httpClient))
                    .build();
        } catch (Exception e) {
            log.warn("Failed to create trust-all RestClient. Falling back to default SSL validation.", e);
            return builder.build();
        }
    }
}
