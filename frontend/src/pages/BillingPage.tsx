import React, { useState } from 'react';
import { CreditCard, PlusCircle } from 'lucide-react';

interface LedgerItem {
  id: number;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

interface ActiveOrder {
  id: string;
  amount: number;
  bank: string;
  accountNumber: string;
  customerName: string;
  dueDate: string;
}

interface BillingPageProps {
  currentUser: {
    balance: number;
    coupons: number;
  };
  onUserUpdate: (updatedUser: { balance: number; coupons: number }) => void;
  ledger: LedgerItem[];
  onAddLedger: (ledgerItem: LedgerItem) => void;
  showAlert: (message: string, type?: string) => void;
}

export default function BillingPage({
  currentUser,
  onUserUpdate,
  ledger,
  onAddLedger,
  showAlert
}: BillingPageProps) {
  const [billingAmount, setBillingAmount] = useState<string>('50000');
  const [billingBank, setBillingBank] = useState<string>('KB');
  const [billingName, setBillingName] = useState<string>('강남길');
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [promoCode, setPromoCode] = useState<string>('');

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const mockOrder: ActiveOrder = {
      id: 'ord-' + Math.floor(Math.random() * 1000000),
      amount: parseInt(billingAmount),
      bank: billingBank,
      accountNumber: '110-' + Math.floor(100000 + Math.random() * 900000) + '-12345',
      customerName: billingName,
      dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
    };
    setActiveOrder(mockOrder);
    showAlert('가상 계좌 주문이 생성되었습니다. 입금 대기 상태입니다.');
  };

  const handleSimulateWebhook = () => {
    if (!activeOrder) return;
    onUserUpdate({
      balance: currentUser.balance + activeOrder.amount,
      coupons: currentUser.coupons
    });
    onAddLedger({
      id: ledger.length + 1,
      amount: activeOrder.amount,
      type: 'CHARGE',
      description: `토스페이먼츠 입금 확인 - 주문번호: ${activeOrder.id}`,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    });
    setActiveOrder(null);
    showAlert('웹훅이 트리거되었습니다! 입금이 완료되어 잔액이 충전되었습니다.', 'success');
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

  const handleRedeemPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (promoCode.trim().toUpperCase() !== 'WELCOME2026') {
      showAlert('유효하지 않은 프로모션 코드입니다.', 'error');
      return;
    }
    if (ledger.some(l => l.type === 'PROMOTION' && l.description === 'WELCOME2026')) {
      showAlert('이미 사용된 프로모션 코드입니다.', 'error');
      return;
    }
    onUserUpdate({
      balance: currentUser.balance + 50000,
      coupons: currentUser.coupons
    });
    onAddLedger({
      id: ledger.length + 1,
      amount: 50000,
      type: 'PROMOTION',
      description: 'WELCOME2026',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    });
    setPromoCode('');
    showAlert('프로모션 코드 WELCOME2026 적용 완료! 50,000 크레딧이 충전되었습니다.', 'success');
  };
  return (
    <div style={{ textAlign: 'left' }}>
      <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>크레딧 결제 및 요금 관리</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>1. 크레딧 충전 (토스페이먼츠 가상계좌)</h3>
            
            <form onSubmit={handleCreateOrder}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                <button 
                  type="button" 
                  className={`btn ${billingAmount === '10000' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setBillingAmount('10000')}
                >
                  10,000 원
                </button>
                <button 
                  type="button" 
                  className={`btn ${billingAmount === '50000' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setBillingAmount('50000')}
                >
                  50,000 원
                </button>
                <button 
                  type="button" 
                  className={`btn ${billingAmount === '100000' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setBillingAmount('100000')}
                >
                  100,000 원
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">입금자명</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={billingName} 
                  onChange={(e) => setBillingName(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">입금 은행</label>
                <select 
                  className="form-input" 
                  value={billingBank} 
                  onChange={(e) => setBillingBank(e.target.value)}
                >
                  <option value="KB">국민은행 (KB)</option>
                  <option value="SHINHAN">신한은행</option>
                  <option value="WOORI">우리은행</option>
                  <option value="TOSS">토스뱅크</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                가상계좌 발급 요청
              </button>
            </form>

            {activeOrder && (
              <div style={{ 
                marginTop: '1.5rem', 
                background: 'var(--bg-tertiary)', 
                padding: '1.25rem', 
                borderRadius: '0.5rem',
                border: '1px dashed var(--accent-border)'
              }}>
                <h4 style={{ color: 'var(--accent-hover)', marginBottom: '0.75rem', fontWeight: 600 }}>토스 가상계좌 발급 완료</h4>
                <p style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>은행: <strong>{activeOrder.bank}</strong></p>
                <p style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>계좌번호: <strong>{activeOrder.accountNumber}</strong></p>
                <p style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>금액: <strong>{activeOrder.amount.toLocaleString()} 원</strong></p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>입금 기한: {activeOrder.dueDate}</p>
                
                <button className="btn btn-success" style={{ width: '100%' }} onClick={handleSimulateWebhook}>
                  입금 완료 웹훅 시뮬레이션
                </button>
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>2. 선결제 테스트 쿠폰 패키지 구매</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="card" style={{ background: 'var(--bg-tertiary)', textAlign: 'center', borderStyle: 'dashed' }}>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>5회 이용권 패키지</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>가격: 50,000 크레딧</div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleBuyCoupons(5)}>구매하기</button>
              </div>
              <div className="card" style={{ background: 'var(--bg-tertiary)', textAlign: 'center', borderStyle: 'dashed' }}>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>10회 이용권 패키지</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>가격: 100,000 크레딧</div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleBuyCoupons(10)}>구매하기</button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>이벤트 프로모션 코드 입력</h3>
            <form onSubmit={handleRedeemPromo} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="WELCOME2026" 
                value={promoCode} 
                onChange={(e) => setPromoCode(e.target.value)} 
                required 
              />
              <button type="submit" className="btn btn-primary">적용하기</button>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>크레딧 거래 원장 (내역)</h3>
            <div className="table-wrapper" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>거래 유형</th>
                    <th>변동 금액</th>
                    <th>거래 일시</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map(l => (
                    <tr key={l.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{l.type === 'CHARGE' ? '충전' : l.type === 'COUPON_BUY' ? '쿠폰 구매' : l.type === 'PROMOTION' ? '프로모션 리워드' : l.type === 'TEST_CONSUME' ? '테스트 실행' : l.type}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{l.description}</div>
                      </td>
                      <td style={{ color: l.amount > 0 ? 'var(--success)' : 'var(--error)', fontWeight: 700 }}>
                        {l.amount > 0 ? '+' : ''}{l.amount.toLocaleString()}
                      </td>
                      <td>{l.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
