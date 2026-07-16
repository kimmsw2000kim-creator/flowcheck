import type { HTMLAttributes, ReactNode } from 'react';

export type CardVariant = 'default' | 'subtle' | 'outlined';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
type CardElement = 'div' | 'section' | 'article' | 'aside';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: CardElement;
  variant?: CardVariant;
  padding?: CardPadding;
  interactive?: boolean;
  children?: ReactNode;
}

export default function Card({
  as: Component = 'div',
  variant = 'default',
  padding = 'md',
  interactive = false,
  className = '',
  children,
  ...props
}: CardProps) {
  const classes = [
    'fc-card',
    `fc-card--${variant}`,
    `fc-card--padding-${padding}`,
    interactive ? 'fc-card--interactive' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}
