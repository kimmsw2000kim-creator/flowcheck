import React from 'react';
import styles from './StatusBadge.module.css';

type BadgeStatus = 'COMPLETED' | 'FAILED' | 'PENDING' | 'RUNNING' | 'SUCCESS' | string;

interface StatusBadgeProps {
  status: BadgeStatus;
  label: string;
}

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const statusKey = status.toLowerCase();
  
  // Map standard status values to their respective class styles
  let statusClass = styles.pending;
  if (statusKey === 'completed' || statusKey === 'success') {
    statusClass = styles.completed;
  } else if (statusKey === 'failed' || statusKey === 'error') {
    statusClass = styles.failed;
  } else if (statusKey === 'running') {
    statusClass = styles.running;
  }

  return (
    <span className={`${styles['status-badge']} ${statusClass}`}>
      {label}
    </span>
  );
}
