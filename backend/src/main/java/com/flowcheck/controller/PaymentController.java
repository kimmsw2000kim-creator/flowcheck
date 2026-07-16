package com.flowcheck.controller;

import com.fasterxml.jackson.databind.JsonNode;

import com.flowcheck.dto.payment.*;
import com.flowcheck.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "Payment", description = "Toss Payments 연동 관련 API")
@Slf4j
@RestController
@RequestMapping("/api/payment")
@RequiredArgsConstructor
@CrossOrigin(origins = { "http://localhost:5173", "https://flow-check.duckdns.org" })
public class PaymentController {

    private final PaymentService paymentService;

    /**
     * 결제 정보 생성
     * 프론트엔드에서 크레딧 패키지를 선택했을 때 호출되어 결제 데이터를 준비하고 고유 orderId를 발급합니다.
     */
    @Operation(summary = "결제 정보 생성 (주문서 생성)", description = "결제를 시작하기 위해 주문 정보를 생성합니다.")
    @PostMapping("/initiate")
    public ResponseEntity<PaymentInitiateResponseDto> initiatePayment(
            @RequestBody PaymentInitiateRequestDto requestDto,
            @AuthenticationPrincipal Jwt jwt) {

        log.info("[API] /api/payment/initiate - 요청 수신");
        // Authorization 헤더의 JWT 토큰에서 Supabase 사용자 이메일 추출
        String email = jwt.getClaimAsString("email");

        // 주문 고유번호(orderId)를 채운 임시 결제 내역을 저장하고 토스 SDK로 넘길 데이터를 응답
        PaymentInitiateResponseDto response = paymentService.initiatePayment(requestDto, email);
        return ResponseEntity.ok(response);
    }

    /**
     * 결제 승인 요청
     * 사용자가 카드 결제창 인증 또는 가상계좌 선택을 마친 후 리다이렉트되었을 때 최종 승인을 대행합니다.
     */
    @Operation(summary = "결제 승인", description = "생성된 주문에 대해 결제를 승인합니다.")
    @PostMapping("/confirm")
    public ResponseEntity<?> confirmPayment(
            @RequestBody PaymentConfirmRequestDto confirmDto,
            @AuthenticationPrincipal Jwt jwt) {

        log.info("[API] /api/payment/confirm - 결제 승인 요청 수신. OrderId: {}", confirmDto.orderId());
        String email = jwt.getClaimAsString("email");
        try {
            // 토스페이먼츠 공식 confirm API를 타사 인증정보와 함께 호출하고 결과 반환
            JsonNode result = paymentService.confirmPayment(confirmDto, email);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Failed to confirm payment for order: {}", confirmDto.orderId(), e);
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    /**
     * 토스페이먼츠 비동기 웹훅
     * 특히 가상계좌의 경우, 사용자가 가상계좌번호를 발급받은 뒤 실제 입금을 완료했을 때 토스 측에서 비동기로 통보해 줍니다.
     */
    @Operation(summary = "결제 혹은 입금 통보 웹훅", description = "토스 페이먼츠로부터 결제 완료 및 가상계좌 입금 완료 알림을 받습니다.")
    @PostMapping("/webhook")
    public ResponseEntity<Void> tossWebhook(@RequestBody TossWebhookDto webhookDto) {
        log.info("[API] /api/payment/webhook - 웹훅 통보 수신");
        try {
            // 웹훅 입금 상태를 확인하여 사용자 잔액을 늘려주고 거래원장에 충전 내역 저장
            paymentService.handleWebhook(webhookDto);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Failed to process Toss Payments webhook", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * 결제 이력 내역 조회
     * 마이페이지 또는 크레딧 상점에서 사용자 결제 이력을 볼 수 있도록 제공합니다.
     */
    @Operation(summary = "결제 내역 조회", description = "현재 로그인한 사용자의 결제 내역을 조회합니다.")
    @GetMapping("/history")
    public ResponseEntity<List<PaymentHistoryResponseDto>> getPaymentHistory(
            @AuthenticationPrincipal Jwt jwt) {

        log.info("[API] /api/payment/history - 결제 내역 조회 요청 수신");
        String email = jwt.getClaimAsString("email");
        List<PaymentHistoryResponseDto> history = paymentService.getPaymentHistory(email);
        return ResponseEntity.ok(history);
    }

    /**
     * 크레딧 거래 내역 조회
     */
    @Operation(summary = "크레딧 거래 내역 조회", description = "현재 로그인한 사용자의 크레딧 거래 내역(원장)을 조회합니다.")
    @GetMapping("/ledger")
    public ResponseEntity<List<CreditsLedgerResponseDto>> getCreditsLedger(
            @AuthenticationPrincipal Jwt jwt) {

        log.info("[API] /api/payment/ledger - 크레딧 거래 내역 조회 요청 수신");
        String email = jwt.getClaimAsString("email");
        List<CreditsLedgerResponseDto> ledger = paymentService.getCreditsLedger(email);
        return ResponseEntity.ok(ledger);
    }

    /**
     * 쿠폰 패키지 구매
     */
    @Operation(summary = "쿠폰 패키지 구매", description = "크레딧을 사용해 테스트 쿠폰 패키지를 구매합니다.")
    @PostMapping("/buy-coupons")
    public ResponseEntity<Void> buyCoupons(
            @RequestBody CouponBuyRequestDto requestDto,
            @AuthenticationPrincipal Jwt jwt) {

        log.info("[API] /api/payment/buy-coupons - 쿠폰 패키지 구매 요청 수신. Count: {}, Type: {}", requestDto.count(),
                requestDto.couponType());
        String email = jwt.getClaimAsString("email");
        paymentService.buyCoupons(email, requestDto.count(), requestDto.couponType());
        return ResponseEntity.ok().build();
    }
}
