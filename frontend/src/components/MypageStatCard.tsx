import type { LucideIcon } from 'lucide-react';

interface MypageStatCardProps {
    icon: LucideIcon;
    label: string;
    value: string;
}

function MypageStatCard({ icon: Icon, label, value }: MypageStatCardProps) {
    return (
        <div className="stat-card">
            <Icon size={20} />
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

export default MypageStatCard;