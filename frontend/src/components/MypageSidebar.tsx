import { NavLink } from 'react-router-dom';

function MypageSidebar() {
  return (
    <aside className="mypage-sidebar">
      <div className="sidebar-section-title">내 활동</div>
      <nav className="sidebar-menu">
        <NavLink className="sidebar-item" to="/mypage/profile">
          회원정보
        </NavLink>

        <NavLink className="sidebar-item" to="/mypage/sites">
          인증된 사이트
        </NavLink>

        <NavLink className="sidebar-item" to="/mypage/tests">
          테스트 이력
        </NavLink>
      </nav>

      <div className="sidebar-section-title">포인트 · 결제</div>
      <nav className="sidebar-menu">
        <NavLink className="sidebar-item" to="/mypage/points">
          쿠폰 · 포인트
        </NavLink>

        <NavLink className="sidebar-item" to="/mypage/point-history">
          포인트 내역
        </NavLink>

        <NavLink className="sidebar-item" to="/mypage/payments">
          결제 내역
        </NavLink>
      </nav>

      <div className="sidebar-section-title">커뮤니티 · 설정</div>
      <nav className="sidebar-menu">
        <NavLink className="sidebar-item" to="/mypage/posts">
          내 글 · 리뷰
        </NavLink>

        <NavLink className="sidebar-item" to="/mypage/notifications">
          알림 설정
        </NavLink>

        <NavLink className="sidebar-item" to="/mypage/theme">
          테마 설정
        </NavLink>

        <NavLink className="sidebar-item" to="/mypage/security">
          계정 · 보안
        </NavLink>
      </nav>
    </aside>
  );
}

export default MypageSidebar;