import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  icon?: LucideIcon;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  loadingText,
  icon: Icon,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const classes = [
    'fc-button',
    'btn',
    `fc-button--${variant}`,
    `btn-${variant}`,
    `fc-button--${size}`,
    fullWidth ? 'fc-button--full-width' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      {...props}
      className={classes}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
    >
      {isLoading ? (
        <>
          <RefreshCw className="fc-button__spinner" size={16} aria-hidden="true" />
          <span>{loadingText || '로딩 중...'}</span>
        </>
      ) : (
        <>
          {Icon && <Icon size={16} aria-hidden="true" />}
          {children}
        </>
      )}
    </button>
  );
}
