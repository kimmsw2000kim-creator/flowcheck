import type { HTMLAttributes } from 'react';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
}

export default function Badge({
  tone = 'neutral',
  size = 'sm',
  className = '',
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={`fc-badge fc-badge--${tone} fc-badge--${size} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}
