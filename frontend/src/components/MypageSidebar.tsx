import { NavLink } from 'react-router-dom';
import type { MypageData } from '../types/mypage';

interface MypageSidebarProps {
  data: MypageData;
}

function MypageSidebar({ data }: MypageSidebarProps) {
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `sidebar-item ${isActive ? 'active' : ''}`;

  return (
    <aside className="mypage-sidebar">
      <div className="sidebar-section-title">내 활동</div>

      <nav className="sidebar-menu">
        <NavLink to="/mypage/profile" className={navClass}>
          <span>로그인 정보</span>
        </NavLink>

        <NavLink to="/mypage/sites" className={navClass}>
          <span>인증 사이트</span>
          <strong>{data.registeredSiteCount}</strong>
        </NavLink>

        <NavLink to="/mypage/tests" className={navClass}>
          <span>테스트 이력</span>
          <strong>{data.testRunCount}</strong>
        </NavLink>
      </nav>

      <div className="sidebar-section-title">포인트 · 결제</div>

      <nav className="sidebar-menu">
        <NavLink to="/mypage/points" className={navClass}>
          <span>포인트</span>
          <strong>{data.balance.toLocaleString()}P</strong>
        </NavLink>

        <NavLink to="/mypage/point-history" className={navClass}>
          <span>포인트 내역</span>
        </NavLink>

        <NavLink to="/mypage/payments" className={navClass}>
          <span>결제 내역</span>
        </NavLink>
      </nav>

      <div className="sidebar-section-title">커뮤니티 · 설정</div>

      <nav className="sidebar-menu">
        <NavLink to="/mypage/posts" className={navClass}>
          <span>내 글 · 리뷰</span>
        </NavLink>

        <NavLink to="/mypage/notifications" className={navClass}>
          <span>알림 설정</span>
        </NavLink>

        <NavLink to="/mypage/theme" className={navClass}>
          <span>테마 설정</span>
        </NavLink>

        <NavLink to="/mypage/security" className={navClass}>
          <span>계정 · 보안</span>
        </NavLink>
      </nav>
    </aside>
  );
}

export default MypageSidebar;