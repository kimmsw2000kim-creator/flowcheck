import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: LucideIcon;
  containerStyle?: React.CSSProperties;
}

export default function TextField({
  label,
  error,
  className = '',
  id,
  leftIcon: Icon,
  style,
  containerStyle,
  ...props
}: TextFieldProps) {
  return (
    <div className="form-group" style={containerStyle}>
      {label && (
        <label htmlFor={id} className="form-label">
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
        {Icon && (
          <Icon
            size={18}
            style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)', pointerEvents: 'none' }}
          />
        )}
        <input
          id={id}
          className={`form-input ${className}`}
          style={{
            paddingLeft: Icon ? '2.25rem' : undefined,
            width: '100%',
            ...style,
          }}
          {...props}
        />
      </div>
      {error && (
        <span style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '0.25rem', textAlign: 'left' }}>
          {error}
        </span>
      )}
    </div>
  );
}
