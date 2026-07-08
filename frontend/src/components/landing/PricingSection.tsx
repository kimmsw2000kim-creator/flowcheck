import React from 'react';
import { CreditCard, Check, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PricingSection() {
  const navigate = useNavigate();

  return (
    <section className="landing-section">
      <div className="landing-section-header">
        <span className="landing-section-subtitle">Flexible Pricing</span>
        <h2 className="landing-section-title">요금제 안내</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', fontSize: '1.05rem' }}>
          매월 청구되는 고정 비용 없이, 사용한 만큼만 차감되는 합리적인 크레딧 충전 방식입니다.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '2.5rem',
        alignItems: 'stretch',
        maxWidth: '1000px',
        margin: '0 auto'
      }}>
        {/* Left Card: Credit usage guide */}
        <div className="pricing-card" style={{ padding: '3rem 2.5rem', justifyContent: 'space-between', border: '1px solid var(--border)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                backgroundColor: 'var(--accent-glow)',
                color: 'var(--accent)',
                borderRadius: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CreditCard size={24} />
              </div>
              <div>
                <h3 className="pricing-plan" style={{ margin: 0 }}>크레딧 소모 요금</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>성능 / UX 자동화 테스트</span>
              </div>
            </div>

            <div style={{ margin: '2rem 0', padding: '1.25rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>테스트 실행 단가</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                1회 실행당 <span style={{ color: 'var(--accent)' }}>10,000 크레딧</span> 소모
              </div>
            </div>

            <ul className="pricing-features-list" style={{ margin: '2rem 0' }}>
              <li className="pricing-feature-item">
                <Check size={16} style={{ color: 'var(--success)' }} />
                <span>AI 자율 부하 테스트 (1회 작동)</span>
              </li>
              <li className="pricing-feature-item">
                <Check size={16} style={{ color: 'var(--success)' }} />
                <span>AI 멀티모달 자율 탐색 UX 감사 (1회 작동)</span>
              </li>
              <li className="pricing-feature-item">
                <Check size={16} style={{ color: 'var(--success)' }} />
                <span>수천 명 가상 VU 동시 시뮬레이션 지원</span>
              </li>
              <li className="pricing-feature-item">
                <Check size={16} style={{ color: 'var(--success)' }} />
                <span>실시간 모니터링 대시보드 및 상세 분석 리포트</span>
              </li>
            </ul>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '0.5rem',
            color: '#166534',
            fontSize: '0.85rem',
            marginBottom: '1.5rem'
          }}>
            <Shield size={16} />
            <span><strong>토스페이먼츠</strong> 안전 간편 결제 완벽 지원</span>
          </div>

          <button className="btn-secondary" style={{ width: '100%' }} onClick={() => navigate('/billing')}>
            크레딧 충전하러 가기
          </button>
        </div>

        {/* Right Card: Discount Packages */}
        <div className="pricing-card popular" style={{ padding: '3rem 2.5rem', justifyContent: 'space-between' }}>
          {/* Highlight Badge */}
          <div className="popular-badge" style={{ whiteSpace: 'nowrap', padding: '0.4rem 1.2rem', fontSize: '0.8rem' }}>
            🔥 최대 30% 파격 할인가 적용 패키지 판매 중
          </div>

          <div>
            <h3 className="pricing-plan" style={{ fontSize: '1.4rem', marginBottom: '0.5rem', marginTop: '0.5rem' }}>코인 패키지 충전</h3>
            <p className="pricing-desc" style={{ marginBottom: '2rem' }}>
              크레딧을 묶음으로 한 번에 충전하고 최대 30% 할인 혜택을 받아보세요. 충전된 크레딧은 유효기간 없이 무제한으로 사용 가능합니다.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-secondary)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>스타터 코인팩</div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>10,000 크레딧</span>
                </div>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>10,000원</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--accent-border)', borderRadius: '0.5rem', backgroundColor: 'var(--accent-glow)', position: 'relative' }}>
                <span style={{ position: 'absolute', top: '-10px', right: '10px', backgroundColor: 'var(--accent)', color: 'white', fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontWeight: 700 }}>+10% 보너스</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>프로 코인팩</div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>50,000 크레딧</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textDecoration: 'line-through', fontWeight: 500 }}>50,000원</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>45,000원</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '2px solid var(--success)', borderRadius: '0.5rem', backgroundColor: 'rgba(13, 148, 136, 0.05)', position: 'relative' }}>
                <span style={{ position: 'absolute', top: '-10px', right: '10px', backgroundColor: 'var(--success)', color: 'white', fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontWeight: 700 }}>+30% 보너스</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--success)' }}>언리미티드 코인팩</div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>100,000 크레딧</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textDecoration: 'line-through', fontWeight: 500 }}>100,000원</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>70,000원</span>
                </div>
              </div>
            </div>
          </div>

          <button className="btn-primary" style={{ width: '100%' }} onClick={() => navigate('/billing')}>
            보너스 패키지 구매하기
          </button>
        </div>
      </div>
    </section>
  );
}
