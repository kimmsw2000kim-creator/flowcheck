import React from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionButton?: React.ReactNode;
}

export default function EmptyState({ title, description, actionButton }: EmptyStateProps) {
  return (
    <div className={styles['empty-state']}>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {actionButton && <div>{actionButton}</div>}
    </div>
  );
}
