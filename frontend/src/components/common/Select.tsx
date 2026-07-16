import { useId } from 'react';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import Field from './Field';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

export default function Select({
  label,
  description,
  error,
  containerClassName = '',
  className = '',
  id,
  required,
  children,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const controlId = id || `fc-select-${generatedId.replace(/:/g, '')}`;
  const describedBy = [
    props['aria-describedby'],
    description ? `${controlId}-description` : '',
    error ? `${controlId}-error` : '',
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <Field
      className={containerClassName}
      label={label}
      htmlFor={controlId}
      description={description}
      error={error}
      required={required}
    >
      <div className="fc-field__control">
        <select
          {...props}
          id={controlId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`fc-select ${className}`.trim()}
        >
          {children}
        </select>
        <span className="fc-select__chevron" aria-hidden="true" />
      </div>
    </Field>
  );
}
