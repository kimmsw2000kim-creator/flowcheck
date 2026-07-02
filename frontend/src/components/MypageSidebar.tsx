import { NavLink } from 'react-router-dom';

function MypageSidebar() {
  return (
    <aside className="mypage-sidebar">
      <div className="sidebar-section-title">활동</div>
      <nav className="sidebar-menu">
        <NavLink to="/mypage/profile" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          회원정보
        </NavLink>
        <NavLink to="/mypage/sites" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          인증한 사이트
        </NavLink>
        <NavLink to="/mypage/tests" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          테스트 이력
        </NavLink>
      </nav>

      <div className="sidebar-section-title">포인트 · 결제</div>
      <nav className="sidebar-menu">
        <NavLink to="/mypage/points" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          이용권 · 포인트
        </NavLink>
        <NavLink to="/mypage/point-history" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          포인트 내역
        </NavLink>
        <NavLink to="/mypage/payments" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          결제 내역
        </NavLink>
      </nav>

      <div className="sidebar-section-title">커뮤니티 · 설정</div>
      <nav className="sidebar-menu">
        <NavLink to="/mypage/posts" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          내 글 · 리뷰
        </NavLink>
        <NavLink to="/mypage/notifications" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          알림 설정
        </NavLink>
        <NavLink to="/mypage/theme" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          테마 설정
        </NavLink>
        <NavLink to="/mypage/security" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          계정 · 보안
        </NavLink>
      </nav>
    </aside>
  );
}

export default MypageSidebar;