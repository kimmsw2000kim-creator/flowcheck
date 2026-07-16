package com.flowcheck.service;

import com.flowcheck.domain.*;
import com.flowcheck.dto.LoadTest.LoadTestResponse;
import com.flowcheck.dto.community.CommunityPostRequest;
import com.flowcheck.dto.community.CommunityPostResponse;
import com.flowcheck.dto.community.CommunityPostUpdateRequest;
import com.flowcheck.dto.community.CommunitySharedTestResultResponse;
import com.flowcheck.dto.uiuxtest.UIUXTestStatusResponse;
import com.flowcheck.repository.CommunityPostRepository;
import com.flowcheck.repository.RegisteredSiteRepository;
import com.flowcheck.repository.TestRequestRepository;
import com.flowcheck.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CommunityPostService {

    private final CommunityPostRepository communityPostRepository;
    private final UserRepository userRepository;
    private final RegisteredSiteRepository registeredSiteRepository;
    private final TestRequestRepository testRequestRepository;

    /*
     * 기존 테스트 결과 생성 로직을 재사용합니다.
     *
     * 커뮤니티 서비스에서 리포트 계산 로직을 중복해서 만들지 않습니다.
     */
    private final LoadTestService loadTestService;
    private final UIUXTestService uiuxTestService;

    /*
     * 카테고리별 게시글 목록을 조회합니다.
     *
     * keyword가 없으면 카테고리 조회만 하고,
     * keyword가 있으면 제목, 내용, 작성자 이메일을 검색합니다.
     */
    public Page<CommunityPostResponse> findPosts(
            PostCategory category,
            String keyword,
            Pageable pageable
    ) {
        Page<CommunityPost> posts;

        if (keyword == null || keyword.isBlank()) {
            posts = communityPostRepository.findByCategory(
                    category,
                    pageable
            );
        } else {
            posts = communityPostRepository.searchByCategory(
                    category,
                    keyword.trim(),
                    pageable
            );
        }

        return posts.map(this::toResponse);
    }

    /*
     * 테스트 공유 게시글과 연결된 실제 결과를 조회합니다.
     *
     * 클라이언트가 requestId를 직접 전달하지 않고
     * postId를 기준으로 서버가 연결된 테스트를 찾습니다.
     */
    public CommunitySharedTestResultResponse findSharedTestResult(
            Long postId
    ) {
        CommunityPost post = communityPostRepository
                .findByPostId(postId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "게시글을 찾을 수 없습니다."
                ));

        /*
         * 사이트 홍보글이나 자유게시판 글에서는
         * 테스트 결과를 조회할 수 없습니다.
         */
        if (post.getCategory() != PostCategory.TEST_SHARE) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "테스트 공유 게시글이 아닙니다."
            );
        }

        /*
         * test_requests.post_id를 이용해
         * 게시글에 실제로 연결된 테스트 요청을 찾습니다.
         */
        TestRequest testRequest = testRequestRepository
                .findByCommunityPost_PostId(postId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "게시글에 연결된 테스트 결과가 없습니다."
                ));

        /*
         * 완료된 테스트만 커뮤니티에 결과를 공개합니다.
         */
        if (!"COMPLETED".equalsIgnoreCase(
                testRequest.getTestStatus()
        )) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "아직 완료되지 않은 테스트입니다."
            );
        }

        String testType = testRequest
                .getTestType()
                .toUpperCase(Locale.ROOT);

        return switch (testType) {
            case "LOAD" -> {
                /*
                 * 기존 부하 테스트 서비스의 결과 계산을 재사용합니다.
                 *
                 * 사용자 ID는 화면에서 받은 값이 아니라
                 * DB에 저장된 테스트 소유자 ID를 사용합니다.
                 */
                LoadTestResponse response =
                        loadTestService.getTestResult(
                                testRequest
                                        .getUser()
                                        .getUserId(),
                                testRequest.getId()
                        );

                if (response.getTestResults() == null) {
                    throw new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "부하 테스트 리포트를 찾을 수 없습니다."
                    );
                }

                yield CommunitySharedTestResultResponse.load(
                        response.getTestResults()
                );
            }

            case "UIUX" -> {
                /*
                 * 기존 UI/UX 결과 생성 로직을 재사용합니다.
                 */
                UIUXTestStatusResponse response =
                        uiuxTestService.getTestStatus(
                                testRequest.getId()
                        );

                /*
                 * URL, 영상, 화면 캡처 등의 민감 정보는 제외하고
                 * 점수와 분석 보고서만 커뮤니티 응답으로 변환합니다.
                 */
                CommunitySharedTestResultResponse.SharedUiuxResult
                        sharedResult =
                        new CommunitySharedTestResultResponse
                                .SharedUiuxResult(
                                response.getReport(),
                                response.getScores(),
                                response.getScoreBreakdown(),
                                response.getEvaluationVersion()
                        );

                yield CommunitySharedTestResultResponse.uiux(
                        sharedResult
                );
            }

            default -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "지원하지 않는 테스트 유형입니다."
            );
        };
    }

    /*
     * 게시글 한 건을 상세 조회합니다.
     */
    public CommunityPostResponse findPost(Long postId) {
        CommunityPost post = communityPostRepository
                .findByPostId(postId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "게시글을 찾을 수 없습니다."
                ));

        return toResponse(post);
    }

    /*
     * 로그인한 사용자의 커뮤니티 게시글을 생성합니다.
     *
     * 작성자 정보는 요청 본문이 아니라 JWT에서 받은 userId를 사용합니다.
     */
    @Transactional
    public CommunityPostResponse create(
            UUID userId,
            CommunityPostRequest request
    ) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "사용자 정보를 찾을 수 없습니다."
                ));

        RegisteredSite site = null;
        TestRequest testRequest = null;
        String promoUrl = null;

        /*
         * 카테고리에 따라 연결할 사이트 또는 테스트를 검사합니다.
         */
        switch (request.category()) {
            case SITE_PROMOTION -> {
                validateSitePromotionRequest(request);

                site = registeredSiteRepository
                        .findById(request.siteId())
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "등록된 사이트를 찾을 수 없습니다."
                        ));

                /*
                 * 다른 사용자의 사이트를 홍보할 수 없도록 소유자를 확인합니다.
                 */
                if (!Objects.equals(
                        site.getUser().getUserId(),
                        userId
                )) {
                    throw new ResponseStatusException(
                            HttpStatus.FORBIDDEN,
                            "본인이 등록한 사이트만 홍보할 수 있습니다."
                    );
                }

                /*
                 * 소유권 인증이 끝난 사이트만 홍보할 수 있습니다.
                 */
                if (!Boolean.TRUE.equals(site.getIsVerified())) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "소유권 인증이 완료된 사이트만 홍보할 수 있습니다."
                    );
                }

                /*
                 * 사용자가 임의 URL을 보내지 못하도록
                 * 등록된 사이트의 주소를 서버에서 가져옵니다.
                 */
                promoUrl = site.getDomainUrl();
            }

            case TEST_SHARE -> {
                validateTestShareRequest(request);



                testRequest = testRequestRepository
                        .findByIdAndUser_UserId(
                                request.testRequestId(),
                                userId
                        )
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "공유할 테스트 결과를 찾을 수 없습니다."
                        ));

                /*
                 * 완료된 테스트 결과만 공유할 수 있습니다.
                 */
                if (!"COMPLETED".equalsIgnoreCase(
                        testRequest.getTestStatus()
                )) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "완료된 테스트 결과만 공유할 수 있습니다."
                    );
                }

                /*
                 * 하나의 테스트 결과가 여러 게시글에 중복 연결되는 것을 막습니다.
                 */
                if (testRequest.getCommunityPost() != null) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "이미 공유된 테스트 결과입니다."
                    );
                }
            }

            case FREE_BOARD -> {
                /*
                 * 자유게시판 게시글에는 사이트와 테스트를 연결하지 않습니다.
                 */
                if (request.siteId() != null
                        || request.testRequestId() != null) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "자유게시판에는 사이트나 테스트를 연결할 수 없습니다."
                    );
                }
            }
        }

        CommunityPost post = CommunityPost.builder()
                .user(user)
                .site(site)
                .category(request.category())
                .title(request.title().trim())
                .content(request.content().trim())
                .promoUrl(promoUrl)
                .build();

        CommunityPost savedPost =
                communityPostRepository.save(post);

        /*
         * TEST_SHARE 게시글이면 test_requests.post_id를 연결합니다.
         */
        if (testRequest != null) {
            testRequest.linkCommunityPost(savedPost);
            testRequestRepository.save(testRequest);
        }

        /*
         * 댓글과 좋아요 기능은 아직 새 테이블에 연결하지 않았으므로
         * 현재 단계에서는 두 개수를 0으로 반환합니다.
         */
        return CommunityPostResponse.from(
                savedPost,
                0L,
                0L,
                testRequest == null ? null : testRequest.getId()
        );
    }

    /*
     * 로그인한 사용자가 작성한 게시글의 제목과 내용을 수정합니다.
     */
    @Transactional
    public CommunityPostResponse update(
            UUID userId,
            Long postId,
            CommunityPostUpdateRequest request
    ) {
        CommunityPost post = findOwnedPost(
                userId,
                postId
        );

        /*
         * 카테고리와 연결 정보는 유지하고 제목과 내용만 변경합니다.
         */
        post.update(
                request.title().trim(),
                request.content().trim()
        );

        /*
         * 트랜잭션이 종료될 때 JPA 변경 감지로 UPDATE가 실행됩니다.
         */
        return toResponse(post);
    }

    /*
     * 로그인한 사용자가 작성한 게시글을 삭제합니다.
     */
    @Transactional
    public void delete(
            UUID userId,
            Long postId
    ) {
        CommunityPost post = findOwnedPost(
                userId,
                postId
        );

        /*
         * 테스트 공유 게시글이 삭제되면 DB의 ON DELETE SET NULL에 의해
         * test_requests.post_id만 null로 변경되고 테스트 이력은 유지됩니다.
         */
        communityPostRepository.delete(post);
    }

    /*
     * 사이트 홍보 요청에 필요한 값과 불필요한 값을 검사합니다.
     */
    private void validateSitePromotionRequest(
            CommunityPostRequest request
    ) {
        if (request.siteId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "사이트 홍보에는 siteId가 필요합니다."
            );
        }

        if (request.testRequestId() != null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "사이트 홍보에는 테스트를 연결할 수 없습니다."
            );
        }
    }

    /*
     * 테스트 공유 요청에 필요한 값과 불필요한 값을 검사합니다.
     */
    private void validateTestShareRequest(
            CommunityPostRequest request
    ) {
        if (request.testRequestId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "테스트 공유에는 testRequestId가 필요합니다."
            );
        }

        if (request.siteId() != null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "테스트 공유에는 사이트를 연결할 수 없습니다."
            );
        }
    }

    /*
     * 게시글을 조회하고 로그인한 사용자가 작성자인지 확인합니다.
     *
     * 수정과 삭제에서 동일한 권한 검사를 사용합니다.
     */
    private CommunityPost findOwnedPost(
            UUID userId,
            Long postId
    ) {
        CommunityPost post = communityPostRepository
                .findByPostId(postId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "게시글을 찾을 수 없습니다."
                ));

        if (!Objects.equals(
                post.getUser().getUserId(),
                userId
        )) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "본인이 작성한 게시글만 수정하거나 삭제할 수 있습니다."
            );
        }

        return post;
    }
    /*
     * 게시글 엔티티를 프론트엔드 응답으로 변환합니다.
     */
    private CommunityPostResponse toResponse(
            CommunityPost post
    ) {
        UUID testRequestId = null;

        if (post.getCategory() == PostCategory.TEST_SHARE) {
            testRequestId = testRequestRepository
                    .findByCommunityPost_PostId(post.getPostId())
                    .map(TestRequest::getId)
                    .orElse(null);
        }

        /*
         * 댓글과 좋아요 Repository 연결 전까지는 0을 반환합니다.
         */
        return CommunityPostResponse.from(
                post,
                0L,
                0L,
                testRequestId
        );
    }
}