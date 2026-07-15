import type { HTMLAttributes, ReactNode } from 'react';

export interface PageHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  headingLevel?: 1 | 2 | 3;
}

export default function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  headingLevel = 1,
  className = '',
  ...props
}: PageHeaderProps) {
  const Heading = `h${headingLevel}` as 'h1' | 'h2' | 'h3';

  return (
    <header className={`fc-page-header ${className}`.trim()} {...props}>
      <div className="fc-page-header__content">
        {eyebrow && <span className="fc-page-header__eyebrow">{eyebrow}</span>}
        <Heading className="fc-page-header__title">{title}</Heading>
        {description && <p className="fc-page-header__description">{description}</p>}
      </div>
      {actions && <div className="fc-page-header__actions">{actions}</div>}
    </header>
  );
}
