function MypageSidebar() {
    return (
        <aside className="mypage-sidebar">
            <div className="sidebar-section-title">내 활동</div>
            <nav className="sidebar-menu">
                <button className="sidebar-item active">회원정보</button>
                <button className="sidebar-item">인증된 사이트</button>
                <button className="sidebar-item">테스트 이력</button>
            </nav>

            <div className="sidebar-section-title">포인트 · 결제</div>
            <nav className="sidebar-menu">
                <button className="sidebar-item">이용권 · 포인트</button>
                <button className="sidebar-item">포인트 내역</button>
                <button className="sidebar-item">결제 내역</button>
            </nav>

            <div className="sidebar-section-title">커뮤니티 · 설정</div>
            <nav className="sidebar-menu">
                <button className="sidebar-item">내 글 · 리뷰</button>
                <button className="sidebar-item">알림 설정</button>
                <button className="sidebar-item">테마 설정</button>
                <button className="sidebar-item">계정 · 보안</button>
            </nav>
        </aside>
    );
}

export default MypageSidebar;