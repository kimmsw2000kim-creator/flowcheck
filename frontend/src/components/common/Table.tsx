import type { HTMLAttributes, TableHTMLAttributes } from 'react';

export type TableDensity = 'compact' | 'comfortable';

export interface TableContainerProps extends HTMLAttributes<HTMLDivElement> {}

export function TableContainer({ className = '', children, ...props }: TableContainerProps) {
  return (
    <div className={`fc-table-container ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  density?: TableDensity;
  hoverable?: boolean;
}

export default function Table({
  density = 'comfortable',
  hoverable = true,
  className = '',
  children,
  ...props
}: TableProps) {
  const classes = [
    'fc-table',
    `fc-table--${density}`,
    hoverable ? 'fc-table--hoverable' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <table className={classes} {...props}>
      {children}
    </table>
  );
}
