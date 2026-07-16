import { useLocation, useNavigate } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import Select from './common/Select';
import styles from '../styles/mypage.module.css';

interface NavigationItem {
  to: string;
  label: string;
}

interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

const navigationGroups: NavigationGroup[] = [
  {
    label: '내 활동',
    items: [
      { to: '/mypage/profile', label: '회원 정보' },
      { to: '/mypage/sites', label: '인증된 사이트' },
      { to: '/mypage/tests', label: '테스트 이력' },
    ],
  },
  {
    label: '포인트 · 결제',
    items: [
      { to: '/mypage/points', label: '쿠폰 · 포인트' },
      { to: '/mypage/point-history', label: '포인트 내역' },
      { to: '/mypage/coupon-history', label: '쿠폰 사용 내역' },
    ],
  },
  {
    label: '커뮤니티 · 설정',
    items: [
      { to: '/mypage/posts', label: '내 글 · 리뷰' },
      { to: '/mypage/notifications', label: '알림 설정' },
      { to: '/mypage/theme', label: '테마 설정' },
      { to: '/mypage/security', label: '계정 · 보안' },
    ],
  },
];

const navigationItems = navigationGroups.flatMap((group) => group.items);

function MypageSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedPath = navigationItems.find((item) =>
    location.pathname.startsWith(item.to)
  )?.to ?? '/mypage/profile';

  return (
    <aside className={styles['mypage-sidebar']}>
      <div className={styles['mypage-mobile-navigation']}>
        <Select
          label="마이페이지 메뉴"
          value={selectedPath}
          onChange={(event) => navigate(event.target.value)}
        >
          {navigationGroups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.items.map((item) => (
                <option key={item.to} value={item.to}>{item.label}</option>
              ))}
            </optgroup>
          ))}
        </Select>
      </div>

      <nav className={styles['mypage-desktop-navigation']} aria-label="마이페이지 메뉴">
        {navigationGroups.map((group) => (
          <div className={styles['sidebar-group']} key={group.label}>
            <div className={styles['sidebar-section-title']}>{group.label}</div>
            <div className={styles['sidebar-menu']}>
              {group.items.map((item) => (
                <NavLink className={styles['sidebar-item']} to={item.to} key={item.to}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export default MypageSidebar;
