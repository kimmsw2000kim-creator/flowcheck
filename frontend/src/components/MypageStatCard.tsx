import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import Card from './common/Card';
import styles from '../styles/mypage.module.css';

interface MypageStatCardProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}

function MypageStatCard({ icon: Icon, label, value }: MypageStatCardProps) {
  return (
    <Card className={styles['stat-card']} padding="sm">
      <Icon size={20} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </Card>
  );
}

export default MypageStatCard;
