import type { HTMLAttributes } from 'react';
import Badge from './Badge';
import type { BadgeTone } from './Badge';

export type BadgeStatus = 'COMPLETED' | 'FAILED' | 'PENDING' | 'RUNNING' | 'SUCCESS' | string;

export interface StatusBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  status: BadgeStatus;
  label: string;
}

export default function StatusBadge({ status, label, ...props }: StatusBadgeProps) {
  const statusKey = status.toLowerCase();
  let tone: BadgeTone = 'warning';

  if (statusKey === 'completed' || statusKey === 'success') {
    tone = 'success';
  } else if (statusKey === 'failed' || statusKey === 'error') {
    tone = 'danger';
  } else if (statusKey === 'running') {
    tone = 'info';
  }

  return (
    <Badge tone={tone} size="md" {...props}>
      {label}
    </Badge>
  );
}
