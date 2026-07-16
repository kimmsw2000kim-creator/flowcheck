import { ShoppingBag, Sparkles } from 'lucide-react';
import type { CreditProduct } from '../../types/payment';
import { Badge, Card } from '../common';

interface CreditPackageSelectorProps {
  products: readonly CreditProduct[];
  selectedProduct: CreditProduct | null;
  onSelectProduct: (product: CreditProduct) => void;
}

export default function CreditPackageSelector({
  products,
  selectedProduct,
  onSelectProduct,
}: CreditPackageSelectorProps) {
  return (
    <section className="payment-products" aria-labelledby="payment-products-title">
      <div className="payment-section-heading">
        <ShoppingBag size={22} aria-hidden="true" />
        <div>
          <span>Credit Packages</span>
          <h3 id="payment-products-title">코인 패키지 충전</h3>
        </div>
      </div>

      <div className="payment-products__grid" role="radiogroup" aria-label="크레딧 충전 상품">
        {products.map((product) => {
          const isSelected = selectedProduct?.id === product.id;
          return (
            <Card
              as="article"
              padding="none"
              interactive
              key={product.id}
              className="payment-product"
              data-selected={isSelected ? 'true' : undefined}
            >
              <input
                id={`credit-product-${product.id}`}
                type="radio"
                name="credit-product"
                className="payment-product__radio"
                checked={isSelected}
                onChange={() => onSelectProduct(product)}
              />
              <label
                htmlFor={`credit-product-${product.id}`}
                className="payment-product__button"
              >
                <Badge tone={product.badgeTone} className="payment-product__badge">{product.badge}</Badge>
                <h4>{product.title}</h4>
                <p>{product.description}</p>
                <div className="payment-product__credits">
                  <span>획득 크레딧</span>
                  <strong><Sparkles size={14} aria-hidden="true" /> {product.credits.toLocaleString()} C</strong>
                </div>
                <div className="payment-product__price">
                  <span>결제 가격</span>
                  <strong>{product.price.toLocaleString()} <small>원</small></strong>
                </div>
              </label>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
