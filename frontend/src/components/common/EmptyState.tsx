import React from 'react';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actionButton?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export default function EmptyState({
  title,
  description,
  actionButton,
  action,
  icon,
  className = '',
  ...props
}: EmptyStateProps) {
  const renderedAction = action ?? actionButton;

  return (
    <div className={`fc-empty-state ${className}`.trim()} {...props}>
      {icon && <div className="fc-empty-state__icon">{icon}</div>}
      <strong className="fc-empty-state__title">{title}</strong>
      {description && <p className="fc-empty-state__description">{description}</p>}
      {renderedAction && <div className="fc-empty-state__action">{renderedAction}</div>}
    </div>
  );
}
