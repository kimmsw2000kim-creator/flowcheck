import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { PageHeader } from '../../components/common';
import UserManagementTab from './UserManagementTab';
import InquiryManagementTab from './InquiryManagementTab';
import StatsManagementTab from './StatsManagementTab';

type AdminTab = 'users' | 'inquiries' | 'stats';
const tabs: Array<{ id: AdminTab; label: string }> = [
  { id: 'users', label: '회원 관리' },
  { id: 'inquiries', label: '문의 관리' },
  { id: 'stats', label: '통계' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('inquiries');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    setActiveTab(tabs[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <section className="utility-page">
      <PageHeader className="utility-page__header" headingLevel={1} eyebrow="ADMIN" title="관리자 페이지" description="회원 상태, 고객 문의와 운영 지표를 관리합니다." />
      <div className="admin-tabs" role="tablist" aria-label="관리자 메뉴">
        {tabs.map((tab, index) => <button
          key={tab.id}
          ref={(element) => { tabRefs.current[index] = element; }}
          type="button"
          role="tab"
          id={`admin-tab-${tab.id}`}
          aria-selected={activeTab === tab.id}
          aria-controls={`admin-panel-${tab.id}`}
          tabIndex={activeTab === tab.id ? 0 : -1}
          className="admin-tab"
          onClick={() => setActiveTab(tab.id)}
          onKeyDown={(event) => handleTabKeyDown(event, index)}
        >{tab.label}</button>)}
      </div>
      <section className="admin-panel" id={`admin-panel-${activeTab}`} role="tabpanel" aria-labelledby={`admin-tab-${activeTab}`} tabIndex={0}>
        {activeTab === 'users' && <UserManagementTab />}
        {activeTab === 'inquiries' && <InquiryManagementTab />}
        {activeTab === 'stats' && <StatsManagementTab />}
      </section>
    </section>
  );
}
