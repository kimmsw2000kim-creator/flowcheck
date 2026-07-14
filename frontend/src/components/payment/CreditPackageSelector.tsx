import { ShoppingBag, Sparkles } from 'lucide-react';
import type { CreditProduct } from '../../types/payment';

interface CreditPackageSelectorProps {
  products: CreditProduct[];
  selectedProduct: CreditProduct | null;
  onSelectProduct: (product: CreditProduct) => void;
}

export default function CreditPackageSelector({
  products,
  selectedProduct,
  onSelectProduct,
}: CreditPackageSelectorProps) {
  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <h3 style={{ marginBottom: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}>
        <ShoppingBag size={22} style={{ color: 'var(--accent)' }} />
        <span>코인 패키지 충전</span>
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {products.map((product) => {
          const isSelected = selectedProduct?.id === product.id;
          return (
            <div
              key={product.id}
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
                overflow: 'hidden',
              }}
              onClick={() => onSelectProduct(product)}
            >
              <span style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: product.badgeColor,
                color: '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.3rem 0.6rem',
                borderRadius: '2rem',
                letterSpacing: '0.5px',
              }}>
                {product.badge}
              </span>

              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {product.title}
              </h4>
              <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {product.description}
              </p>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-tertiary)',
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                marginBottom: '1rem',
              }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>획득 크레딧</span>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Sparkles size={14} style={{ color: 'var(--warning)' }} />
                  {product.credits.toLocaleString()} C
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '1.25rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>결제 가격</span>
                <span style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--accent)' }}>
                  {product.price.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 600 }}>원</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
