import type { HTMLAttributes, ReactNode } from 'react';

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label?: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
}

export default function Field({
  label,
  htmlFor,
  description,
  error,
  required = false,
  children,
  className = '',
  ...props
}: FieldProps) {
  const descriptionId = htmlFor && description ? `${htmlFor}-description` : undefined;
  const errorId = htmlFor && error ? `${htmlFor}-error` : undefined;

  return (
    <div className={`fc-field ${className}`.trim()} {...props}>
      {label && (
        <label className="fc-field__label" htmlFor={htmlFor}>
          {label}
          {required && <span className="fc-field__required" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {description && (
        <p className="fc-field__description" id={descriptionId}>
          {description}
        </p>
      )}
      {error && (
        <p className="fc-field__error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
