package com.flowcheck.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowcheck.domain.Coupon;
import com.flowcheck.domain.CouponType;
import com.flowcheck.domain.UserCoupon;
import com.flowcheck.domain.CreditsLedger;
import com.flowcheck.domain.TossPayment;
import com.flowcheck.domain.User;
import com.flowcheck.dto.payment.*;
import com.flowcheck.repository.CouponRepository;
import com.flowcheck.repository.UserCouponRepository;
import com.flowcheck.repository.CreditsLedgerRepository;
import com.flowcheck.repository.TossPaymentRepository;
import com.flowcheck.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class PaymentService {

    private final UserRepository userRepository;
    private final TossPaymentRepository tossPaymentRepository;
    private final CreditsLedgerRepository creditsLedgerRepository;
    private final CouponRepository couponRepository;
    private final UserCouponRepository userCouponRepository;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    // application.yml 에 맵핑된 토스페이먼츠 연동 키 (없을 경우 기본 위젯 테스트 키 바인딩)
    @Value("${toss.secret-key:test_sk_zXLkKEypN3WQNWn9J2wJ3w7oK2EX}")
    private String secretKey;

    @Value("${toss.client-key:test_ck_GjL1Z5z2oK60k7N1L2yJ3wLxN4E0}")
    private String clientKey;

    /**
     * 빈 초기화 후 키 정합성 기본 세팅
     */
    @PostConstruct
    public void init() {
        if (secretKey == null || secretKey.trim().isEmpty()) {
            secretKey = "test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6";
        }
        if (clientKey == null || clientKey.trim().isEmpty()) {
            clientKey = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";
        }
        log.info("Payment Service initialized with ClientKey: {}", clientKey);
    }

    /**
     * 결제 정보 생성 (주문서 생성)
     * 프론트엔드에서 코인 패키지를 선택했을 때 호출되어 결제 데이터를 준비하고 고유 orderId를 발급합니다.
     */
    @Transactional
    public PaymentInitiateResponseDto initiatePayment(PaymentInitiateRequestDto requestDto, String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // 토스 권장 규격에 맞춰 고유한 주문 번호 발급 (ord- + 18자리 임의문자열)
        String orderId = "ord-" + UUID.randomUUID().toString().substring(0, 18);
        String orderName = "플로우체크 크레딧 충전 - " + requestDto.amount() + "원";

        // READY 상태의 임시 TossPayment 기록 추가
        TossPayment tossPayment = TossPayment.builder()
                .user(user)
                .orderId(orderId)
                .amount(requestDto.amount())
                .customerName(user.getEmail())
                .paymentStatus("READY")
                .build();

        tossPaymentRepository.save(tossPayment);
        log.info("Initiated payment order: {} for user: {}", orderId, email);

        // 위젯 SDK 초기화에 필요한 정보 전달
        return new PaymentInitiateResponseDto(
                clientKey,
                user.getUserId().toString(),
                orderId,
                orderName,
                requestDto.amount());
    }

    /**
     * 결제 완료 인증 후 최종 승인 처리
     * 토스페이먼츠 공식 백엔드 REST API를 타격해 승인을 요청하고 결제 정보를 업데이트합니다.
     */
    @Transactional
    public JsonNode confirmPayment(PaymentConfirmRequestDto confirmDto, String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        TossPayment tossPayment = tossPaymentRepository.findByOrderId(confirmDto.orderId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Payment record not found for orderId: " + confirmDto.orderId()));

        // 데이터 무결성 검증 (요청금액과 DB 기록금액 일치 여부)
        if (!tossPayment.getAmount().equals(confirmDto.amount())) {
            throw new IllegalArgumentException("Amount mismatch between request and record.");
        }

        // 토스페이먼츠 인증 헤더 (Basic Auth: secretKey + ":"를 Base64 인코딩)
        String basicAuthHeader = "Basic "
                + Base64.getEncoder().encodeToString((secretKey + ":").getBytes(StandardCharsets.UTF_8));

        log.info("Sending payment confirm to Toss Payments for order: {}", confirmDto.orderId());

        String tossResponseString;
        try {
            // 토스 결제 승인 API 타격
            tossResponseString = restClient.post()
                    .uri("https://api.tosspayments.com/v1/payments/confirm")
                    .header("Authorization", basicAuthHeader)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "paymentKey", confirmDto.paymentKey(),
                            "orderId", confirmDto.orderId(),
                            "amount", confirmDto.amount()))
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(), (req, res) -> {
                        String errorText = new String(res.getBody().readAllBytes(), StandardCharsets.UTF_8);
                        log.error("Toss Payments confirm error response: {}", errorText);
                        throw new RuntimeException("Toss API error: " + errorText);
                    })
                    .body(String.class);
        } catch (Exception e) {
            log.error("Failed to communicate with Toss Payments API", e);
            throw new RuntimeException("Toss Payments confirmation request failed: " + e.getMessage());
        }

        try {
            // 결과 JSON 파싱 및 저장
            JsonNode responseJson = objectMapper.readTree(tossResponseString);
            String status = responseJson.path("status").asText();
            tossPayment.setPaymentKey(confirmDto.paymentKey());
            tossPayment.setPaymentStatus(status);

            // 가상계좌(Virtual Account) 정보가 있다면 해당 입금 정보를 DB에 기입
            if (responseJson.has("virtualAccount")) {
                JsonNode va = responseJson.path("virtualAccount");
                tossPayment.setAccountNumber(va.path("accountNumber").asText());
                tossPayment.setBankCode(va.has("bank") ? va.path("bank").asText() : va.path("bankCode").asText());
                tossPayment.setCustomerName(va.path("customerName").asText());

                String dueDateStr = va.path("dueDate").asText();
                if (dueDateStr != null && !dueDateStr.isEmpty()) {
                    tossPayment.setDueDate(OffsetDateTime.parse(dueDateStr));
                }
            }

            tossPaymentRepository.save(tossPayment);
            log.info("Updated TossPayment status to: {} for order: {}", status, confirmDto.orderId());

            // 만약 카드 결제와 같이 승인 즉시 결제가 최종 완료(DONE)된 경우 잔액 충전 진행
            if ("DONE".equalsIgnoreCase(status)) {
                creditUserBalance(user, tossPayment);
            }

            return responseJson;
        } catch (Exception e) {
            log.error("Failed to parse Toss Payments confirm response", e);
            throw new RuntimeException("Failed to confirm payment details: " + e.getMessage());
        }
    }

    /**
     * 비동기 입금 확인 웹훅 통보 처리
     * 가상계좌로 구매자가 무통장 입금을 완료했을 때 토스 측에서 호출해줍니다.
     */
    @Transactional
    public void handleWebhook(TossWebhookDto webhookDto) {
        String orderId = webhookDto.getOrderId();
        if (orderId == null) {
            log.warn("Toss Webhook received without orderId. Event: {}", webhookDto.eventType());
            return;
        }

        log.info("Toss Webhook received for order: {}, event: {}", orderId, webhookDto.eventType());

        TossPayment tossPayment = tossPaymentRepository.findByOrderId(orderId)
                .orElseThrow(
                        () -> new IllegalArgumentException("Payment record not found for webhook orderId: " + orderId));

        // 이미 결제가 완료된 주문이면 스킵
        if ("DONE".equalsIgnoreCase(tossPayment.getPaymentStatus())) {
            log.info("Payment for order: {} is already in DONE state. Ignoring webhook.", orderId);
            return;
        }

        // 웹훅 데이터로부터 가상계좌의 입금 완료(DONE) 상태 확인
        String incomingStatus = webhookDto.data() != null ? webhookDto.data().status() : null;
        if (incomingStatus == null) {
            // 예외/호환성 처리: 특정 입금 완료 이벤트의 경우 DONE으로 강제 매핑
            if ("VIRTUAL_ACCOUNT_DEPOSIT_COMPLETED".equalsIgnoreCase(webhookDto.eventType())
                    || "DEPOSIT_RECEIVED".equalsIgnoreCase(webhookDto.eventType())) {
                incomingStatus = "DONE";
            }
        }

        if ("DONE".equalsIgnoreCase(incomingStatus)) {
            tossPayment.setPaymentStatus("DONE");
            if (webhookDto.data() != null && webhookDto.data().paymentKey() != null) {
                tossPayment.setPaymentKey(webhookDto.data().paymentKey());
            }
            tossPaymentRepository.save(tossPayment);

            // 유저 크레딧 증가 및 원장 추가
            User user = tossPayment.getUser();
            creditUserBalance(user, tossPayment);

            log.info("Toss payment deposit completed successfully via webhook for orderId: {}", orderId);
        }
    }

    /**
     * 사용자 결제 내역 전체 조회
     */
    @Transactional(readOnly = true)
    public List<PaymentHistoryResponseDto> getPaymentHistory(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<TossPayment> payments = tossPaymentRepository.findByUser_UserIdOrderByCreatedAtDesc(user.getUserId());

        return payments.stream()
                .map(p -> new PaymentHistoryResponseDto(
                        p.getPaymentId(),
                        p.getOrderId(),
                        p.getPaymentKey(),
                        p.getAmount(),
                        p.getAccountNumber(),
                        p.getBankCode(),
                        p.getCustomerName(),
                        p.getPaymentStatus(),
                        p.getDueDate(),
                        p.getCreatedAt()))
                .toList();
    }

    /**
     * 실제 사용자 잔액(Balance)을 충전하고, credits_ledger 테이블에 충전 이력을 남기는 유틸 메소드
     */
    private void creditUserBalance(User user, TossPayment payment) {
        // 결제 금액(KRW)에 따른 실제 지급 크레딧(C) 계산
        int creditAmount = payment.getAmount();
        if (payment.getAmount() == 45000) {
            creditAmount = 50000;
        } else if (payment.getAmount() == 70000) {
            creditAmount = 100000;
        }

        // 사용자 크레딧 추가 및 저장
        user.chargeBalance(creditAmount);
        userRepository.save(user);

        // 잔액 변동 원장 테이블에 기록 적재
        CreditsLedger ledger = CreditsLedger.builder()
                .user(user)
                .amount(creditAmount)
                .transactionType("CHARGE")
                .description("Toss Payments 크레딧 충전 - 주문번호: " + payment.getOrderId())
                .build();

        creditsLedgerRepository.save(ledger);
        log.info("Credited {} credits to user: {} for completed order: {}", creditAmount, user.getEmail(),
                payment.getOrderId());
    }

    /**
     * 사용자 크레딧 거래 내역 전체 조회
     */
    @Transactional(readOnly = true)
    public List<CreditsLedgerResponseDto> getCreditsLedger(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<CreditsLedger> ledgers = creditsLedgerRepository.findByUser_UserIdOrderByCreatedAtDesc(user.getUserId());
        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

        return ledgers.stream()
                .map(l -> new CreditsLedgerResponseDto(
                        l.getId(),
                        l.getAmount(),
                        l.getTransactionType(),
                        l.getDescription(),
                        l.getCreatedAt() != null ? l.getCreatedAt().format(formatter) : ""))
                .toList();
    }

    /**
     * 쿠폰 패키지 구매
     */
    @Transactional
    public void buyCoupons(String email, int count, CouponType couponType) {
        CouponType targetType = couponType != null ? couponType : CouponType.LOAD_TEST;
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        int unitPrice = targetType == CouponType.UIUX_TEST ? 1000 : 10000;
        int cost = count * unitPrice;
        if (user.getBalance() < cost) {
            throw new IllegalStateException("크레딧 잔액이 부족합니다.");
        }

        user.deductBalance(cost);
        userRepository.save(user);

        String couponCode = "COUPON_" + targetType.name() + "_" + count;
        Coupon coupon = couponRepository.findByCouponCode(couponCode)
                .orElseGet(() -> {
                    Coupon newCoupon = Coupon.builder()
                            .couponCode(couponCode)
                            .testCount(count)
                            .creditPrice(cost)
                            .couponType(targetType)
                            .isActive(true)
                            .build();
                    return couponRepository.save(newCoupon);
                });

        UserCoupon userCoupon = UserCoupon.builder()
                .user(user)
                .coupon(coupon)
                .remainingChances(count)
                .build();
        userCouponRepository.save(userCoupon);

        CreditsLedger ledger = CreditsLedger.builder()
                .user(user)
                .amount(-cost)
                .transactionType("COUPON_BUY")
                .description("선결제 테스트 쿠폰 구매: " + count + "회권 (" + targetType + ")")
                .build();
        creditsLedgerRepository.save(ledger);

        log.info("User {} successfully bought a {}-coupon ({}) package for {} credits.", email, count, targetType, cost);
    }
}
