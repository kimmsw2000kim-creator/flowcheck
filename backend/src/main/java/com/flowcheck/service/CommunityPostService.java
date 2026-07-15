package com.flowcheck.service;

import com.flowcheck.domain.CommunityPost;
import com.flowcheck.domain.PostCategory;
import com.flowcheck.domain.RegisteredSite;
import com.flowcheck.domain.TestRequest;
import com.flowcheck.domain.User;
import com.flowcheck.dto.community.CommunityPostRequest;
import com.flowcheck.dto.community.CommunityPostResponse;
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