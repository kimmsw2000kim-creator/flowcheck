import React from 'react';
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
  billingAmount: string;
  setBillingAmount: (amt: string) => void;
  billingBank: string;
  setBillingBank: (bank: string) => void;
  billingName: string;
  setBillingName: (name: string) => void;
  activeOrder: ActiveOrder | null;
  handleCreateOrder: (e: React.FormEvent) => void;
  handleSimulateWebhook: () => void;
  handleBuyCoupons: (count: number) => void;
  promoCode: string;
  setPromoCode: (code: string) => void;
  handleRedeemPromo: (e: React.FormEvent) => void;
  ledger: LedgerItem[];
}

export default function BillingPage({
  billingAmount,
  setBillingAmount,
  billingBank,
  setBillingBank,
  billingName,
  setBillingName,
  activeOrder,
  handleCreateOrder,
  handleSimulateWebhook,
  handleBuyCoupons,
  promoCode,
  setPromoCode,
  handleRedeemPromo,
  ledger
}: BillingPageProps) {
  return (
    <div style={{ textAlign: 'left' }}>
      <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Credits Billing & Payment</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>1. Charge Credits (Toss Payments Virtual Account)</h3>
            
            <form onSubmit={handleCreateOrder}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                <button 
                  type="button" 
                  className={`btn ${billingAmount === '10000' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setBillingAmount('10000')}
                >
                  10,000 KRW
                </button>
                <button 
                  type="button" 
                  className={`btn ${billingAmount === '50000' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setBillingAmount('50000')}
                >
                  50,000 KRW
                </button>
                <button 
                  type="button" 
                  className={`btn ${billingAmount === '100000' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setBillingAmount('100000')}
                >
                  100,000 KRW
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Depositor Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={billingName} 
                  onChange={(e) => setBillingName(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Preferred Bank</label>
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
                Request Virtual Account
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
                <h4 style={{ color: 'var(--accent-hover)', marginBottom: '0.75rem', fontWeight: 600 }}>Toss Virtual Account Issued</h4>
                <p style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>Bank: <strong>{activeOrder.bank}</strong></p>
                <p style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>Account No: <strong>{activeOrder.accountNumber}</strong></p>
                <p style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>Amount: <strong>{activeOrder.amount.toLocaleString()} KRW</strong></p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Due Date: {activeOrder.dueDate}</p>
                
                <button className="btn btn-success" style={{ width: '100%' }} onClick={handleSimulateWebhook}>
                  Simulate Deposit Webhook
                </button>
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>2. Purchase Prepaid Test Coupon Packages</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="card" style={{ background: 'var(--bg-tertiary)', textAlign: 'center', borderStyle: 'dashed' }}>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>5 Runs Pack</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>Cost: 50,000 credits</div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleBuyCoupons(5)}>Buy Pack</button>
              </div>
              <div className="card" style={{ background: 'var(--bg-tertiary)', textAlign: 'center', borderStyle: 'dashed' }}>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>10 Runs Pack</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>Cost: 100,000 credits</div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleBuyCoupons(10)}>Buy Pack</button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Event Promo Coupon Code</h3>
            <form onSubmit={handleRedeemPromo} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="WELCOME2026" 
                value={promoCode} 
                onChange={(e) => setPromoCode(e.target.value)} 
                required 
              />
              <button type="submit" className="btn btn-primary">Apply</button>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Credits Transaction Ledger</h3>
            <div className="table-wrapper" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Flow</th>
                    <th>Adjustment</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map(l => (
                    <tr key={l.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{l.type}</div>
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
