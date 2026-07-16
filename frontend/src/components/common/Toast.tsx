import React from 'react';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';
import styles from './Toast.module.css';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info' | string;
}

export default function Toast({ message, type = 'success' }: ToastProps) {
  // Select appropriate class style based on the alert type
  let typeClass = styles.success;
  let Icon = CheckCircle;

  if (type === 'error') {
    typeClass = styles.error;
    Icon = AlertCircle;
  } else if (type === 'warning') {
    typeClass = styles.warning;
    Icon = AlertCircle;
  } else if (type === 'info') {
    typeClass = styles.info;
    Icon = Info;
  }

  const isAssertive = type === 'error' || type === 'warning';

  return (
    <div
      className={`${styles.toast} ${typeClass}`}
      role={isAssertive ? 'alert' : 'status'}
      aria-live={isAssertive ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <Icon size={20} />
      <span>{message}</span>
    </div>
  );
}
