package com.flowcheck.config;

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

@Configuration
public class RestClientConfig {

    /**
     * 사설/개발/보안망 네트워크 환경에서 발생하는 인증서 신뢰 오류(PKIX path building failed)를
     * 우회하기 위해 모든 SSL 인증서를 임시로 신뢰(Trust-All)하도록 설정된 RestClient 빈(Bean)을 정의합니다.
     */
    @Bean
    public RestClient customRestClient(RestClient.Builder builder) {
        try {
            // 1. 모든 신뢰인증서 유효성 체크를 무조건 통과시키는 TrustManager 구현체 선언
            TrustManager[] trustAllCerts = new TrustManager[]{
                new X509TrustManager() {
                    public X509Certificate[] getAcceptedIssuers() { return null; }
                    public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                    public void checkServerTrusted(X509Certificate[] certs, String authType) {}
                }
            };

            // 2. TLS 프로토콜 SSL Context 초기화 및 우회 TrustManager 등록
            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, trustAllCerts, new SecureRandom());

            // 3. 우회 SSL Context가 바인딩된 자바 내장 HttpClient 빌드
            HttpClient httpClient = HttpClient.newBuilder()
                    .sslContext(sslContext)
                    .version(HttpClient.Version.HTTP_1_1)
                    .build();

            // 4. Spring의 JdkClientHttpRequestFactory를 사용하여 커스텀 HttpClient를 RestClient 빌더에 적용
            return builder
                    .requestFactory(new JdkClientHttpRequestFactory(httpClient))
                    .build();
        } catch (Exception e) {
            // 예외 발생 시 표준 검증이 적용된 기본 빌더 구조로 안전한 폴백(Fallback) 진행
            return builder.build();
        }
    }
}
