import { PageHeader } from '../common';
import styles from '../../styles/landing.module.css';

interface LandingSectionHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
}

export default function LandingSectionHeader({ eyebrow, title, description }: LandingSectionHeaderProps) {
  return (
    <PageHeader
      className={styles['section-header']}
      headingLevel={2}
      eyebrow={eyebrow}
      title={title}
      description={description}
    />
  );
}
