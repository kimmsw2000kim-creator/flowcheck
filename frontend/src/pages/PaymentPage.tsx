import React, { useState, useEffect } from 'react';
import { CreditCard, RefreshCw, ShoppingBag, ShieldCheck, Coins, Ticket, Sparkles, History, Gift } from 'lucide-react';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import { getAccessToken } from '../api/authApi';
import axios from 'axios';

interface LedgerItem {
  id: number;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

interface VirtualAccountDetails {
  bank: string;
  accountNumber: string;
  customerName: string;
  amount: number;
  dueDate: string;
  orderId: string;
}

interface PaymentPageProps {
  currentUser: {
    email: string;
    balance: number;
    coupons: number;
  };
  onUserUpdate: (updatedUser: { balance: number; coupons: number }) => void;
  ledger: LedgerItem[];
  onAddLedger: (ledgerItem: LedgerItem) => void;
  showAlert: (message: string, type?: string) => void;
}

const creditOptions = [
  {
    id: 'CREDIT_10K',
    title: '스타터 코인팩',
    credits: 10000,
    price: 10000,
    description: '기본 기능 체험을 위한 기본 충전',
    badge: '스타터',
    badgeColor: '#64748b'
  },
  {
    id: 'CREDIT_50K',
    title: '프로 코인팩',
    credits: 50000,
    price: 45000,
    description: '10% 보너스 크레딧 추가 적립 패키지',
    badge: '인기 상품',
    badgeColor: '#0d9488'
  },
  {
    id: 'CREDIT_100K',
    title: '언리미티드 코인팩',
    credits: 100000,
    price: 70000,
    description: '최대 30% 파격 할인가 적용 베스트 팩',
    badge: '최대 할인',
    badgeColor: '#d97706'
  },
];

export default function PaymentPage({
  currentUser,
  onUserUpdate,
  ledger,
  onAddLedger,
  showAlert
}: PaymentPageProps) {
  // Coin pack selection state
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Toss payments state
  const [showTossWidget, setShowTossWidget] = useState<boolean>(false);
  const [tossWidgets, setTossWidgets] = useState<any>(null);
  const [widgetReady, setWidgetReady] = useState<boolean>(false);
  const [paymentInitiateResponse, setPaymentInitiateResponse] = useState<any>(null);
  const [confirmLoading, setConfirmLoading] = useState<boolean>(false);
  const [confirmedVirtualAccount, setConfirmedVirtualAccount] = useState<VirtualAccountDetails | null>(null);

  // 1. URL Query Parameter 확인 및 결제 승인 요청 처리 (Mount 시점)
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const paymentKey = queryParams.get('paymentKey');
    const orderId = queryParams.get('orderId');
    const amount = queryParams.get('amount');
    const paymentError = queryParams.get('paymentError');
    const errorMessage = queryParams.get('message');

    // URL 지우기
    if (paymentKey || orderId || amount || paymentError) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (paymentError) {
      showAlert(errorMessage || '결제가 취소되었거나 실패했습니다.', 'error');
      return;
    }

    if (paymentKey && orderId && amount) {
      const accessToken = getAccessToken();
      if (!accessToken) {
        showAlert('결제 승인을 위해 로그인이 필요합니다.', 'error');
        return;
      }

      setConfirmLoading(true);

      axios.post('/api/payment/confirm', {
        paymentKey,
        orderId,
        amount: parseInt(amount)
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      .then((response) => {
        const data = response.data;
        const status = data.status; // DONE, WAITING_FOR_DEPOSIT

        if (status === 'DONE') {
          // 결제 완료 (카드 등 즉시 충전) - 결제 금액(KRW)에 맞는 크레딧(C) 매핑 지급
          let creditsAwarded = parseInt(amount);
          if (creditsAwarded === 45000) {
            creditsAwarded = 50000;
          } else if (creditsAwarded === 70000) {
            creditsAwarded = 100000;
          }

          // 백엔드 DB의 최신 정보(이전 잔액 + 충전액)를 동기화하여 레이스 컨디션 방지
          axios.get('/api/mypage', {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          })
          .then((res) => {
            const mypageData = res.data;
            onUserUpdate({
              balance: mypageData.balance,
              coupons: mypageData.couponCount
            });
            onAddLedger({
              id: ledger.length + 1,
              amount: creditsAwarded,
              type: 'CHARGE',
              description: `토스페이먼츠 결제 완료 - 주문번호: ${orderId}`,
              createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
            });
            showAlert('결제가 성공적으로 완료되었습니다! 크레딧이 충전되었습니다.', 'success');
          })
          .catch((err) => {
            console.error('Failed to sync updated balance:', err);
            // 폴백: 로컬 계산값으로 우선 세팅
            onUserUpdate({
              balance: currentUser.balance + creditsAwarded,
              coupons: currentUser.coupons
            });
            showAlert('결제가 완료되었습니다! (잔액 동기화 실패, 새로고침 필요)', 'warning');
          });
        } else if (status === 'WAITING_FOR_DEPOSIT') {
          // 가상계좌 발급 성공 (입금 대기)
          const va = data.virtualAccount;
          if (va) {
            setConfirmedVirtualAccount({
              bank: va.bank || va.bankCode || '가상은행',
              accountNumber: va.accountNumber,
              customerName: va.customerName || '고객',
              amount: parseInt(amount),
              dueDate: va.dueDate ? new Date(va.dueDate).toISOString().substring(0, 10) : '',
              orderId: orderId
            });
            showAlert('가상계좌가 발급되었습니다. 지정된 계좌로 입금해 주세요.', 'success');
          } else {
            showAlert('가상계좌 정보가 없습니다.', 'error');
          }
        }
      })
      .catch((err) => {
        console.error('Confirm payment failed:', err);
        const errMsg = err?.response?.data?.message || err.message;
        showAlert('결제 승인 처리에 실패했습니다: ' + errMsg, 'error');
      })
      .finally(() => {
        setConfirmLoading(false);
      });
    }
  }, []);

  // 2. 상품 선택 시 자동 결제 요청 생성 (Backend initiate API 호출)
  useEffect(() => {
    if (!selectedProduct) {
      setShowTossWidget(false);
      setTossWidgets(null);
      setWidgetReady(false);
      setPaymentInitiateResponse(null);
      return;
    }

    const accessToken = getAccessToken();
    if (!accessToken) {
      showAlert('결제를 진행하려면 로그인이 필요합니다.', 'error');
      setSelectedProduct(null);
      return;
    }

    setConfirmLoading(true);

    axios.post('/api/payment/initiate', 
      { amount: selectedProduct.price }, 
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )
    .then((response) => {
      const data = response.data;
      setPaymentInitiateResponse(data);
      setShowTossWidget(true);
      setWidgetReady(false);
    })
    .catch((err) => {
      console.error('Initiate payment failed:', err);
      const errMsg = err?.response?.data?.message || err.message;
      showAlert('결제 정보를 생성하는 중 오류가 발생했습니다: ' + errMsg, 'error');
      setSelectedProduct(null);
    })
    .finally(() => {
      setConfirmLoading(false);
    });
  }, [selectedProduct]);

  // 3. 결제 요청 정보가 성공적으로 준비되면 Toss Widgets 렌더링
  useEffect(() => {
    if (!showTossWidget || !paymentInitiateResponse) return;

    let widgetsInstance: any = null;

    loadTossPayments(paymentInitiateResponse.clientKey)
      .then((tossPayments) => {
        const widgets = tossPayments.widgets({
          customerKey: paymentInitiateResponse.customerKey
        });
        widgetsInstance = widgets;
        setTossWidgets(widgets);

        return widgets.setAmount({
          currency: 'KRW',
          value: paymentInitiateResponse.amount
        });
      })
      .then(() => {
        return Promise.all([
          widgetsInstance.renderPaymentMethods({
            selector: '#payment-method',
            variantKey: 'DEFAULT'
          }),
          widgetsInstance.renderAgreement({
            selector: '#agreement',
            variantKey: 'AGREEMENT'
          })
        ]);
      })
      .then(() => {
        setWidgetReady(true);
      })
      .catch((err) => {
        console.error('Failed to render Toss widget:', err);
        showAlert('결제 모듈을 불러오는 중 오류가 발생했습니다.', 'error');
      });

    return () => {
      const methodEl = document.getElementById('payment-method');
      const agreementEl = document.getElementById('agreement');
      if (methodEl) methodEl.innerHTML = '';
      if (agreementEl) agreementEl.innerHTML = '';
    };
  }, [showTossWidget, paymentInitiateResponse]);

  // 4. 결제 실행 (토스 위젯 트리거)
  const handlePaymentRequest = () => {
    if (!tossWidgets || !paymentInitiateResponse || !widgetReady) return;

    tossWidgets.requestPayment({
      orderId: paymentInitiateResponse.orderId,
      orderName: paymentInitiateResponse.orderName,
      successUrl: `${window.location.origin}/billing`,
      failUrl: `${window.location.origin}/billing?paymentError=true`
    })
    .catch((err: any) => {
      console.error('Payment request error:', err);
      showAlert('결제 요청에 실패했습니다.', 'error');
    });
  };

  const handleCancelWidget = () => {
    setSelectedProduct(null);
  };

  const handleBuyCoupons = (count: number) => {
    const cost = count * 10000;
    if (currentUser.balance < cost) {
      showAlert('크레딧 잔액이 부족합니다.', 'error');
      return;
    }
    onUserUpdate({
      balance: currentUser.balance - cost,
      coupons: currentUser.coupons + count
    });
    onAddLedger({
      id: ledger.length + 1,
      amount: -cost,
      type: 'COUPON_BUY',
      description: `선결제 테스트 쿠폰 구매: ${count}회권`,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    });
    showAlert(`테스트 쿠폰 ${count}회권을 성공적으로 구매하였습니다!`);
  };



  return (
    <div style={{ textAlign: 'left', maxWidth: '1200px', margin: '0 auto', padding: '1rem 0' }}>
      
      {/* 1. 보유 잔액 정보 (Hero 섹션, 그라디언트 글래스모피즘 효과) */}
      <div style={{
        background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)',
        borderRadius: '1.25rem',
        padding: '2.25rem 2.5rem',
        color: '#ffffff',
        boxShadow: '0 10px 25px rgba(2, 132, 199, 0.22)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2.5rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* 장식용 서클 백그라운드 */}
        <div style={{
          position: 'absolute',
          right: '-5%',
          top: '-30%',
          width: '240px',
          height: '240px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.08)',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          left: '30%',
          bottom: '-50%',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.04)',
          pointerEvents: 'none'
        }} />

        <div style={{ zIndex: 2 }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9 }}>
            FlowCheck 계정 잔액
          </span>
          <h1 style={{ fontSize: '3rem', fontWeight: 900, margin: '0.25rem 0', textShadow: '0 2px 10px rgba(0, 0, 0, 0.1)' }}>
            {(currentUser.balance || 0).toLocaleString()} <span style={{ fontSize: '1.75rem', fontWeight: 600 }}>C</span>
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>이메일 계정: {currentUser.email || '게스트'}</p>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', zIndex: 2 }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: '1rem',
            padding: '1rem 1.5rem',
            textAlign: 'center',
            minWidth: '130px'
          }}>
            <Coins size={20} style={{ margin: '0 auto 0.35rem auto', display: 'block', color: '#fef08a' }} />
            <span style={{ fontSize: '0.75rem', display: 'block', opacity: 0.85 }}>충전 포인트</span>
            <strong style={{ fontSize: '1.15rem' }}>{(currentUser.balance || 0).toLocaleString()} P</strong>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: '1rem',
            padding: '1rem 1.5rem',
            textAlign: 'center',
            minWidth: '130px'
          }}>
            <Ticket size={20} style={{ margin: '0 auto 0.35rem auto', display: 'block', color: '#99f6e4' }} />
            <span style={{ fontSize: '0.75rem', display: 'block', opacity: 0.85 }}>보유 테스트 쿠폰</span>
            <strong style={{ fontSize: '1.15rem' }}>{(currentUser.coupons || 0).toLocaleString()} 개</strong>
          </div>
        </div>
      </div>

      {confirmLoading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '1rem',
          marginBottom: '1.5rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '0.5rem',
          color: 'var(--accent-hover)',
          border: '1px solid var(--border)'
        }}>
          <RefreshCw className="animate-spin" size={16} />
          <span>결제 처리를 진행 중입니다. 잠시만 기다려 주세요...</span>
        </div>
      )}

      {/* 2. 코인 패키지 상품 선택 카드 그리드 */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ marginBottom: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}>
          <ShoppingBag size={22} style={{ color: 'var(--accent)' }} />
          <span>코인 패키지 충전</span>
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {creditOptions.map((option) => {
            const isSelected = selectedProduct?.id === option.id;
            return (
              <div 
                key={option.id} 
                className={`card ${isSelected ? 'selected' : ''}`}
                style={{ 
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--accent-hover)' : '1px solid var(--border)',
                  boxShadow: isSelected ? '0 12px 30px rgba(2, 132, 199, 0.12)' : 'var(--card-shadow)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: isSelected ? 'translateY(-4px)' : 'none',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '1rem',
                  padding: '1.75rem',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onClick={() => {
                  setSelectedProduct(option);
                }}
              >
                {/* 인기 뱃지 */}
                <span style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: option.badgeColor,
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '0.3rem 0.6rem',
                  borderRadius: '2rem',
                  letterSpacing: '0.5px'
                }}>
                  {option.badge}
                </span>

                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {option.title}
                </h4>
                <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {option.description}
                </p>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-tertiary)',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  marginBottom: '1rem'
                }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>획득 크레딧</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Sparkles size={14} style={{ color: 'var(--warning)' }} />
                    {option.credits.toLocaleString()} C
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '1.25rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>결제 가격</span>
                  <span style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--accent)' }}>
                    {option.price.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 600 }}>원</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. 분할 그리드 레이아웃 (결제 패널 & 부가 패키지 및 결제 내역) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '2.5rem' }}>
        <div>
          {/* 선택된 코인팩 결제 카드 */}
          {selectedProduct && paymentInitiateResponse && (
            <div className="card" style={{ 
              marginBottom: '2rem', 
              border: '1px solid var(--accent-border)',
              borderRadius: '1rem',
              padding: '2rem',
              backgroundColor: 'var(--bg-secondary)',
              boxShadow: 'var(--card-shadow)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>주문 결제서</h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    선택하신 충전 금액과 상품을 확인하고 아래에서 결제를 진행해 주세요.
                  </p>
                </div>

                {/* 상품 정보 초소형 요약 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '1.25rem',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-tertiary)'
                }}>
                  <div style={{
                    background: 'var(--accent)',
                    color: '#ffffff',
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <CreditCard size={20} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{selectedProduct.title}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedProduct.description}</span>
                  </div>
                </div>

                {/* 그리드 명세 정보 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  textAlign: 'center'
                }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>크레딧</label>
                    <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{selectedProduct.credits.toLocaleString()} C</strong>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>결제 금액</label>
                    <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{selectedProduct.price.toLocaleString()} 원</strong>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>상품 코드</label>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{selectedProduct.id}</strong>
                  </div>
                </div>

                {/* Toss Widgets 렌더링 영역 */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <div id="payment-method" style={{ minHeight: '280px', backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }} />
                  <div id="agreement" style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }} />
                  
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button 
                      onClick={handlePaymentRequest} 
                      className="btn btn-primary" 
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.85rem', fontSize: '1rem' }} 
                      disabled={!widgetReady}
                    >
                      {!widgetReady && <RefreshCw className="animate-spin" size={16} />}
                      <span>{selectedProduct.price.toLocaleString()}원 결제하기</span>
                    </button>
                    <button onClick={handleCancelWidget} className="btn btn-secondary" style={{ flex: 0.3 }}>
                      취소
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <ShieldCheck size={14} style={{ color: 'var(--success)' }} />
                  <span>토스페이먼츠 보안 암호화 결제 시스템이 적용되어 있습니다.</span>
                </div>
              </div>
            </div>
          )}

          {confirmedVirtualAccount && (
            <div className="card" style={{ 
              marginBottom: '2rem', 
              background: 'var(--bg-secondary)', 
              padding: '1.5rem', 
              borderRadius: '1rem',
              border: '2px dashed var(--success)',
              boxShadow: 'var(--card-shadow)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
                <h4 style={{ color: 'var(--success)', margin: 0, fontWeight: 700, fontSize: '1.1rem' }}>가상계좌 입금 대기 안내</h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.9rem', marginBottom: '1rem' }}>
                <div style={{ color: 'var(--text-secondary)' }}>입금 은행:</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{confirmedVirtualAccount.bank}</div>
                <div style={{ color: 'var(--text-secondary)' }}>계좌 번호:</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'underline' }}>{confirmedVirtualAccount.accountNumber}</div>
                <div style={{ color: 'var(--text-secondary)' }}>예금주 명:</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{confirmedVirtualAccount.customerName}</div>
                <div style={{ color: 'var(--text-secondary)' }}>입금 금액:</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{confirmedVirtualAccount.amount.toLocaleString()} 원</div>
                <div style={{ color: 'var(--text-secondary)' }}>입금 기한:</div>
                <div style={{ fontWeight: 700, color: 'var(--error)' }}>{confirmedVirtualAccount.dueDate} 까지</div>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                ⚠️ 상기 발급 계좌로 결제 기한 내에 이체해 주시면 백엔드 자동 입금 확인 웹훅을 통해 실시간으로 잔액이 충전됩니다.
              </p>
            </div>
          )}

          {/* 선결제 쿠폰 구매 섹션 */}
          <div className="card" style={{ borderRadius: '1rem', padding: '1.75rem', backgroundColor: 'var(--bg-secondary)', boxShadow: 'var(--card-shadow)' }}>
            <h3 style={{ marginBottom: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
              <Gift size={18} style={{ color: 'var(--accent)' }} />
              <span>선결제 테스트 쿠폰 패키지 구매</span>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div className="card" style={{ background: 'var(--bg-tertiary)', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>5회 이용권 패키지</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>가격: 50,000 크레딧</div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleBuyCoupons(5)}>구매하기</button>
              </div>
              <div className="card" style={{ background: 'var(--bg-tertiary)', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>10회 이용권 패키지</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>가격: 100,000 크레딧</div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleBuyCoupons(10)}>구매하기</button>
              </div>
            </div>
          </div>
        </div>

        <div>
          {/* 거래 내역 섹션 */}
          <div className="card" style={{ borderRadius: '1rem', padding: '1.75rem', backgroundColor: 'var(--bg-secondary)', boxShadow: 'var(--card-shadow)' }}>
            <h3 style={{ marginBottom: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
              <History size={18} style={{ color: 'var(--accent)' }} />
              <span>크레딧 거래 내역</span>
            </h3>
            <div className="table-wrapper" style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '0.5rem' }}>
              <table className="custom-table" style={{ fontSize: '0.85rem', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem' }}>거래 유형</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>변동 금액</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>거래 일시</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger && ledger.length > 0 ? (
                    ledger.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {l.type === 'CHARGE' ? '크레딧 충전' : l.type === 'COUPON_BUY' ? '쿠폰 패키지 구매' : l.type === 'PROMOTION' ? '프로모션 보상' : l.type === 'TEST_CONSUME' ? '테스트 차감' : l.type}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>{l.description}</div>
                        </td>
                        <td style={{ 
                          padding: '0.75rem 1rem', 
                          textAlign: 'right', 
                          color: l.amount > 0 ? 'var(--success)' : 'var(--error)', 
                          fontWeight: 800,
                          fontSize: '0.95rem'
                        }}>
                          {l.amount > 0 ? '+' : ''}{l.amount.toLocaleString()}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          {l.createdAt}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>거래 내역이 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
