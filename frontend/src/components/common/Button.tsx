import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  isLoading?: boolean;
  loadingText?: string;
  icon?: LucideIcon;
}

export default function Button({
  children,
  variant = 'primary',
  isLoading = false,
  loadingText,
  icon: Icon,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  // Map variant to global css classes
  const variantClass = `btn-${variant}`;

  return (
    <button
      className={`btn ${variantClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <RefreshCw className="animate-spin" size={16} />
          <span>{loadingText || '로딩 중...'}</span>
        </>
      ) : (
        <>
          {Icon && <Icon size={16} />}
          {children}
        </>
      )}
    </button>
  );
}
