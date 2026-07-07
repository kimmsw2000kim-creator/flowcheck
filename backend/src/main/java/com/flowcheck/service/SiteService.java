package com.flowcheck.service;

import com.flowcheck.domain.RegisteredSite;
import com.flowcheck.domain.User;
import com.flowcheck.dto.SiteRegisterRequestDTO;
import com.flowcheck.dto.SiteResponseDTO;
import com.flowcheck.repository.RegisteredSiteRepository;
import com.flowcheck.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SiteService {

    private final RegisteredSiteRepository registeredSiteRepository;
    private final UserRepository userRepository;

    @Transactional
    public SiteResponseDTO registerSite(String email, SiteRegisterRequestDTO requestDTO) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        String domainUrl = normalizeUrl(requestDTO.getDomainUrl());

        // 해당 유저가 동일 도메인을 이미 등록했는지 검증
        List<RegisteredSite> existingSites = registeredSiteRepository.findByUser_UserIdOrderByCreatedAtDesc(user.getUserId());
        boolean isDuplicate = existingSites.stream()
                .anyMatch(site -> site.getDomainUrl().equalsIgnoreCase(domainUrl));
        if (isDuplicate) {
            throw new IllegalArgumentException("이미 등록된 도메인입니다.");
        }

        // 토큰 생성 (overload-verify-[random 18자])
        String token = "overload-verify-" + UUID.randomUUID().toString().replace("-", "").substring(0, 18);

        RegisteredSite site = RegisteredSite.builder()
                .user(user)
                .domainUrl(domainUrl)
                .verificationToken(token)
                .isVerified(false)
                .serviceName(requestDTO.getServiceName() != null ? requestDTO.getServiceName() : extractHostName(domainUrl))
                .build();

        RegisteredSite saved = registeredSiteRepository.save(site);
        return SiteResponseDTO.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<SiteResponseDTO> getSites(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        List<RegisteredSite> sites = registeredSiteRepository.findByUser_UserIdOrderByCreatedAtDesc(user.getUserId());
        return sites.stream()
                .map(SiteResponseDTO::fromEntity)
                .toList();
    }

    @Transactional
    public SiteResponseDTO verifySite(String email, Long siteId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        RegisteredSite site = registeredSiteRepository.findById(siteId)
                .orElseThrow(() -> new IllegalArgumentException("등록된 도메인 사이트를 찾을 수 없습니다."));

        if (!site.getUser().getUserId().equals(user.getUserId())) {
            throw new IllegalArgumentException("해당 도메인의 소유권 확인 권한이 없습니다.");
        }

        if (site.getIsVerified()) {
            return SiteResponseDTO.fromEntity(site);
        }

        String domainUrl = site.getDomainUrl();
        String token = site.getVerificationToken();

        boolean verified = false;

        // 1. HTML 메타 태그 검증 시도
        try {
            verified = verifyMetaTag(domainUrl, token);
        } catch (Exception e) {
            log.warn("HTML 메타 태그를 통한 검증 실패. Domain: {}, Error: {}", domainUrl, e.getMessage());
        }

        // 2. 메타 태그 검증 실패 시, 텍스트 파일 검증 시도
        if (!verified) {
            try {
                verified = verifyTextFile(domainUrl, token);
            } catch (Exception e) {
                log.warn("텍스트 파일을 통한 검증 실패. Domain: {}, Error: {}", domainUrl, e.getMessage());
            }
        }

        if (verified) {
            site.markAsVerified();
            RegisteredSite saved = registeredSiteRepository.save(site);
            return SiteResponseDTO.fromEntity(saved);
        } else {
            throw new IllegalStateException("도메인 소유권을 검증할 수 없습니다. 메타 태그나 텍스트 파일 설정을 확인해 주세요.");
        }
    }

    private boolean verifyMetaTag(String domainUrl, String token) throws IOException {
        log.info("메타 태그 검증 시작 - URL: {}", domainUrl);
        Document doc = Jsoup.connect(domainUrl)
                .timeout(5000)
                .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) FlowCheckVerification/1.0")
                .get();

        Element meta = doc.selectFirst("meta[name=overload-verification]");
        if (meta != null) {
            String content = meta.attr("content");
            log.info("메타 태그 발견 - content: {}", content);
            return token.equals(content);
        }
        log.info("메타 태그(name=overload-verification)를 찾을 수 없습니다.");
        return false;
    }

    private boolean verifyTextFile(String domainUrl, String token) throws IOException {
        String txtUrl = domainUrl + "/.well-known/overload-verification.txt";
        log.info("텍스트 파일 검증 시작 - URL: {}", txtUrl);

        String body = Jsoup.connect(txtUrl)
                .ignoreContentType(true)
                .timeout(5000)
                .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) FlowCheckVerification/1.0")
                .execute()
                .body();

        if (body != null) {
            String trimmedBody = body.trim();
            log.info("텍스트 파일 내용: {}", trimmedBody);
            return token.equals(trimmedBody);
        }
        return false;
    }

    private String normalizeUrl(String url) {
        if (url == null) return null;
        String trimmed = url.trim();
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            trimmed = "https://" + trimmed;
        }
        // 끝의 / 문자 제거
        if (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private String extractHostName(String url) {
        try {
            java.net.URI uri = new java.net.URI(url);
            String host = uri.getHost();
            if (host != null) {
                if (host.startsWith("www.")) {
                    return host.substring(4);
                }
                return host;
            }
        } catch (Exception ignored) {}
        return url;
    }
}
