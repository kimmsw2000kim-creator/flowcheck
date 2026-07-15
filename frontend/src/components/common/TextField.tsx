import React, { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import Field from './Field';

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  leftIcon?: LucideIcon;
  containerStyle?: React.CSSProperties;
  containerClassName?: string;
}

export default function TextField({
  label,
  description,
  error,
  className = '',
  id,
  leftIcon: Icon,
  style,
  containerStyle,
  containerClassName = '',
  required,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const controlId = id || `fc-input-${generatedId.replace(/:/g, '')}`;
  const describedBy = [
    props['aria-describedby'],
    description ? `${controlId}-description` : '',
    error ? `${controlId}-error` : '',
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <Field
      className={`form-group ${containerClassName}`.trim()}
      style={containerStyle}
      label={label}
      htmlFor={controlId}
      description={description}
      error={error}
      required={required}
    >
      <div className="fc-field__control">
        {Icon && <Icon size={18} className="fc-field__icon" aria-hidden="true" />}
        <input
          {...props}
          id={controlId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`fc-input form-input ${Icon ? 'fc-input--with-icon' : ''} ${className}`.trim()}
          style={style}
        />
      </div>
    </Field>
  );
}
