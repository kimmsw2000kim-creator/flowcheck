package com.flowcheck.service;

import com.flowcheck.domain.CouponType;
import com.flowcheck.domain.CouponUsageLog;
import com.flowcheck.domain.Comment;
import com.flowcheck.domain.CommunityPost;
import com.flowcheck.domain.CommunityPostComment;
import com.flowcheck.domain.CreditsLedger;
import com.flowcheck.domain.LoadTestReport;
import com.flowcheck.domain.Post;
import com.flowcheck.domain.RegisteredSite;
import com.flowcheck.domain.TestRequest;
import com.flowcheck.domain.User;
import com.flowcheck.dto.mypage.MypageCouponHistoryResponseDTO;
import com.flowcheck.dto.mypage.MypageCommunityActivityResponseDTO;
import com.flowcheck.dto.mypage.MypagePointHistoryResponseDTO;
import com.flowcheck.dto.mypage.MypageResponseDTO;
import com.flowcheck.dto.mypage.MypageTestHistoryResponseDTO;
import com.flowcheck.dto.mypage.SiteSummaryResponseDTO;
import com.flowcheck.dto.uiuxtest.UIUXTestStatusResponse;
import com.flowcheck.repository.CouponUsageLogRepository;
import com.flowcheck.repository.CommentRepository;
import com.flowcheck.repository.CommunityPostRepository;
import com.flowcheck.repository.CommunityPostCommentRepository;
import com.flowcheck.repository.CreditsLedgerRepository;
import com.flowcheck.repository.LoadTestReportRepository;
import com.flowcheck.repository.PostRepository;
import com.flowcheck.repository.RegisteredSiteRepository;
import com.flowcheck.repository.TestRequestRepository;
import com.flowcheck.repository.UIUXTestReportRepository;
import com.flowcheck.repository.UserCouponRepository;
import com.flowcheck.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MypageService {
        private final RegisteredSiteRepository registeredSiteRepository;
        private final TestRequestRepository testRequestRepository;
        private final UserCouponRepository userCouponRepository;
        private final UserRepository userRepository;
        private final CreditsLedgerRepository creditsLedgerRepository;
        private final CouponUsageLogRepository couponUsageLogRepository;
        private final UIUXTestService uiuxTestService;
        private final LoadTestReportRepository loadTestReportRepository;
        private final UIUXTestReportRepository uiuxTestReportRepository;
        private final CommunityPostRepository communityPostRepository;
        private final CommunityPostCommentRepository communityPostCommentRepository;
        private final PostRepository postRepository;
        private final CommentRepository commentRepository;

        @Value("${supabase.url}")
        private String supabaseUrl;

        public MypageResponseDTO getMyPage(UUID userId) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new IllegalArgumentException("User not found"));

                int couponCount = userCouponRepository.sumRemainingChancesByUserId(userId);
                int loadTestCouponCount = userCouponRepository.sumRemainingChancesByUserIdAndCouponType(userId, CouponType.LOAD_TEST);
                int UIUXTestCouponCount = userCouponRepository.sumRemainingChancesByUserIdAndCouponType(userId, CouponType.UIUX_TEST);
                long registeredSiteCount = registeredSiteRepository.countByUser_UserId(userId);
                long testRunCount = testRequestRepository.countByUser_UserId(userId);

                List<RegisteredSite> registeredSites = registeredSiteRepository
                                .findByUser_UserIdOrderByCreatedAtDesc(userId);

                List<SiteSummaryResponseDTO> sites = registeredSites.stream()
                                .map(site -> new SiteSummaryResponseDTO(
                                                site.getId(),
                                                site.getServiceName(),
                                                site.getDomainUrl(),
                                                site.getIsVerified(),
                                                site.getCreatedAt()))
                                .toList();

                return new MypageResponseDTO(
                                user.getEmail(),
                                user.getRole(),
                                user.getStatus().name(),
                                user.getAvatarUrl(),
                                user.getBalance(),
                                couponCount,
                                loadTestCouponCount,
                                UIUXTestCouponCount,
                                registeredSiteCount,
                                testRunCount,
                                sites);
        }

        @Transactional
        public String updateAvatarUrl(UUID userId, String avatarUrl) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "사용자를 찾을 수 없습니다."));

                // 프로필 URL 검증
                String normalizedAvatarUrl = normalizeAvatarUrl(avatarUrl);
                user.updateAvatarUrl(normalizedAvatarUrl);
                userRepository.save(user);
                return normalizedAvatarUrl;
        }

        @Transactional
        public void withdrawAccount(UUID userId) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "사용자를 찾을 수 없습니다."));

                // 사용자 데이터는 보존하고 계정 접근만 영구 차단합니다.
                user.withdraw();
                userRepository.save(user);
        }

        private String normalizeAvatarUrl(String avatarUrl) {
                if (avatarUrl == null || avatarUrl.isBlank()) {
                        return null;
                }

                String normalized = avatarUrl.trim();
                String storagePrefix = supabaseUrl.replaceAll("/+$", "")
                                + "/storage/v1/object/public/avatars/";

                if (normalized.length() > 2048 || !normalized.startsWith(storagePrefix)) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "허용되지 않은 프로필 사진 URL입니다.");
                }

                return normalized;
        }

        public List<MypageTestHistoryResponseDTO> getTestHistory(UUID userId) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new IllegalArgumentException("User not found"));

                List<MypageTestHistoryResponseDTO> histories = new ArrayList<>();

                List<TestRequest> loadTests = testRequestRepository.findByUserAndTestTypeOrderByCreatedAtAsc(user, "LOAD");
                loadTests.forEach(test -> {
                        Integer performanceScore = loadTestReportRepository.findByTestRequestId(test.getId())
                                        .map(this::extractLoadPerformanceScore)
                                        .orElse(null);
                        histories.add(new MypageTestHistoryResponseDTO(
                                        test.getId(),
                                        "LOAD",
                                        "부하 테스트",
                                        test.getTargetUrl(),
                                        test.getTestStatus(),
                                        test.getTestPhase(),
                                        test.getTestProgress(),
                                        performanceScore,
                                        null,
                                        null,
                                        null,
                                        performanceScore,
                                        null,
                                        test.getPromptInput(),
                                        test.getCreatedAt(),
                                        test.getUpdatedAt(),

                                        // 이미 공유된 테스트인지 프런트에서 구분할 수 있게 게시글 ID를 전달합니다.
                                        test.getCommunityPost() == null
                                                ? null
                                                : test.getCommunityPost().getPostId()));
                });

                List<TestRequest> uiRequests = testRequestRepository.findByUserAndTestTypeOrderByCreatedAtAsc(user, "UIUX");
                uiRequests.forEach(test -> {
                        var report = uiuxTestReportRepository.findScoresProjectionByTestRequestId(test.getId()).orElse(null);
                        histories.add(new MypageTestHistoryResponseDTO(
                                        test.getId(),
                                        "UIUX",
                                        "UI/UX 테스트",
                                        test.getTargetUrl(),
                                        test.getTestStatus(),
                                        test.getTestPhase(),
                                        test.getTestProgress(),
                                        report != null ? report.getOverallScore() : null,
                                        report != null ? report.getScoreUsability() : null,
                                        report != null ? report.getScoreAccessibility() : null,
                                        report != null ? report.getScoreEfficiency() : null,
                                        report != null ? report.getScorePerformance() : null,
                                        report != null ? report.getScoreBestPractices() : null,
                                        test.getPromptInput(),
                                        test.getCreatedAt(),
                                        test.getUpdatedAt(),

                                        // LOAD 테스트와 동일하게 공유된 게시글 ID를 전달합니다.
                                        test.getCommunityPost() == null
                                                ? null
                                                : test.getCommunityPost().getPostId()));
                });

                histories.sort(Comparator.comparing(
                                MypageTestHistoryResponseDTO::createdAt,
                                Comparator.nullsLast(Comparator.reverseOrder())));

                return histories;
        }

        public Page<MypageCommunityActivityResponseDTO> getCommunityActivities(
                        UUID userId,
                        String activityType,
                        Pageable pageable) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "사용자를 찾을 수 없습니다."));

                String normalizedType = normalizeActivityType(activityType);
                List<CommunityPost> communityPosts = communityPostRepository
                                .findByUser_UserId(userId, Pageable.unpaged())
                                .getContent();
                List<Post> freeBoardPosts = postRepository
                                .findByUserIdOrderByCreatedAtDesc(userId.toString());
                List<Comment> comments = commentRepository
                                .findByWriterEmailIgnoreCaseOrderByCreatedAtDesc(user.getEmail());
                List<CommunityPostComment> communityComments = communityPostCommentRepository
                                .findByUser_UserIdOrderByCreatedAtDesc(userId);

                // 댓글 대상 게시글 일괄 조회
                Map<Long, Post> commentPosts = new HashMap<>();
                postRepository.findAllById(comments.stream().map(Comment::getPostId).distinct().toList())
                                .forEach(post -> commentPosts.put(post.getId(), post));

                // 두 게시판 활동 통합
                List<MypageCommunityActivityResponseDTO> activities = new ArrayList<>();
                if (!"COMMENT".equals(normalizedType)) {
                        communityPosts.stream()
                                        .map(this::toCommunityPostActivity)
                                        .forEach(activities::add);
                        freeBoardPosts.stream()
                                        .map(this::toFreeBoardPostActivity)
                                        .forEach(activities::add);
                }
                if (!"POST".equals(normalizedType)) {
                        communityComments.stream()
                                        .map(this::toCommunityCommentActivity)
                                        .forEach(activities::add);
                        comments.stream()
                                        .map(comment -> toCommentActivity(comment, commentPosts.get(comment.getPostId())))
                                        .forEach(activities::add);
                }

                activities.sort(Comparator.comparing(
                                MypageCommunityActivityResponseDTO::createdAt,
                                Comparator.nullsLast(Comparator.reverseOrder())));

                int pageSize = Math.min(Math.max(pageable.getPageSize(), 1), 50);
                int pageNumber = pageable.getPageNumber();
                int fromIndex = Math.min(pageNumber * pageSize, activities.size());
                int toIndex = Math.min(fromIndex + pageSize, activities.size());
                Pageable normalizedPageable = PageRequest.of(pageNumber, pageSize);

                return new PageImpl<>(activities.subList(fromIndex, toIndex), normalizedPageable, activities.size());
        }

        private String normalizeActivityType(String activityType) {
                String normalized = activityType == null
                                ? "ALL"
                                : activityType.trim().toUpperCase(Locale.ROOT);
                if (!List.of("ALL", "POST", "COMMENT").contains(normalized)) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "활동 유형은 ALL, POST, COMMENT 중 하나여야 합니다.");
                }
                return normalized;
        }

        private MypageCommunityActivityResponseDTO toCommunityPostActivity(CommunityPost post) {
                return new MypageCommunityActivityResponseDTO(
                                "POST",
                                "COMMUNITY",
                                post.getCategory().name(),
                                post.getPostId(),
                                post.getPostId(),
                                post.getTitle(),
                                post.getContent(),
                                post.getCreatedAt());
        }

        private MypageCommunityActivityResponseDTO toFreeBoardPostActivity(Post post) {
                return new MypageCommunityActivityResponseDTO(
                                "POST",
                                "FREE_BOARD",
                                "FREE_BOARD",
                                post.getId(),
                                post.getId(),
                                post.getTitle(),
                                post.getContent(),
                                toOffsetDateTime(post.getCreatedAt()));
        }

        private MypageCommunityActivityResponseDTO toCommentActivity(Comment comment, Post post) {
                return new MypageCommunityActivityResponseDTO(
                                comment.getParentId() == null ? "COMMENT" : "REPLY",
                                "FREE_BOARD",
                                "FREE_BOARD",
                                comment.getId(),
                                comment.getPostId(),
                                post == null ? "삭제된 게시글" : post.getTitle(),
                                comment.getContent(),
                                toOffsetDateTime(comment.getCreatedAt()));
        }

        private MypageCommunityActivityResponseDTO toCommunityCommentActivity(
                        CommunityPostComment comment) {
                CommunityPost post = comment.getPost();
                return new MypageCommunityActivityResponseDTO(
                                comment.getParent() == null ? "COMMENT" : "REPLY",
                                "COMMUNITY",
                                post.getCategory().name(),
                                comment.getId(),
                                post.getPostId(),
                                post.getTitle(),
                                comment.getContent(),
                                comment.getCreatedAt());
        }

        private OffsetDateTime toOffsetDateTime(LocalDateTime dateTime) {
                return dateTime == null
                                ? null
                                : dateTime.atZone(ZoneId.of("Asia/Seoul")).toOffsetDateTime();
        }

        private Integer extractLoadPerformanceScore(LoadTestReport report) {
                if (report.getRawMetrics() == null) {
                        return null;
                }
                Object score = report.getRawMetrics().get("performanceScore");
                if (score instanceof Number number) {
                        return number.intValue();
                }
                if (score instanceof String text) {
                        try {
                                return Integer.parseInt(text);
                        } catch (NumberFormatException ignored) {
                                return null;
                        }
                }
                return null;
        }

        public UIUXTestStatusResponse getUIUXTestDetail(UUID userId, UUID requestId) {
                return uiuxTestService.getTestStatusForUser(userId, requestId);
        }

        public List<MypagePointHistoryResponseDTO> getPointHistory(UUID userId) {
                List<CreditsLedger> ledgers = creditsLedgerRepository.findByUser_UserIdOrderByCreatedAtDesc(userId);

                return ledgers.stream()
                                .map(ledger -> new MypagePointHistoryResponseDTO(
                                                ledger.getId(),
                                                ledger.getAmount(),
                                                ledger.getTransactionType(),
                                                ledger.getDescription(),
                                                ledger.getCreatedAt()))
                                .toList();
        }

        public List<MypageCouponHistoryResponseDTO> getCouponUsageHistory(UUID userId) {
                if (!userRepository.existsById(userId)) {
                        throw new IllegalArgumentException("User not found");
                }

                List<CouponUsageLog> logs = couponUsageLogRepository.findByUser_UserIdOrderByUsedAtDesc(userId);

                return logs.stream()
                                .map(log -> new MypageCouponHistoryResponseDTO(
                                                log.getId(),
                                                log.getCouponType() != null ? log.getCouponType().name() : "UNKNOWN",
                                                log.getDescription(),
                                                log.getUsedAt()))
                                .toList();
        }
}
