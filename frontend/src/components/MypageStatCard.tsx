import type { LucideIcon } from 'lucide-react';
import styles from '../styles/mypage.module.css';

interface MypageStatCardProps {
    icon: LucideIcon;
    label: string;
    value: string;
}

function MypageStatCard({ icon: Icon, label, value }: MypageStatCardProps) {
    return (
        <div className={styles['stat-card']}>
            <Icon size={20} />
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

export default MypageStatCard;