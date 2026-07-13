import { Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../store/userStore";

interface HeaderProps {
  activeTab: string;
}

const ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  domains: "/domains",
  UIUXTest: "/UIUXTest",
  load: "/load",
  billing: "/billing",
  community: "/community",
  comment: "/comment",
  support: "/support",
  admin: "/admin",
  mypage: "/mypage",
  login: "/login",
  signup: "/signup",
};

export default function Header({ activeTab }: HeaderProps) {
  const navigate = useNavigate();

  const { currentUser, authStatus, toggleRole } = useUserStore();

  const isLoggedIn = authStatus === "authenticated";

  const handleNavClick = (tab: string) => {
    navigate(ROUTES[tab] ?? "/dashboard");
  };

  const getNavClassName = (tab: string) => {
    return `nav-item ${activeTab === tab ? "active" : ""}`;
  };

  return (
    <nav className="navbar">
      <button
        type="button"
        className="logo"
        onClick={() =>
          handleNavClick(isLoggedIn ? "dashboard" : "login")
        }
        style={{
          cursor: "pointer",
          background: "transparent",
          border: "none",
        }}
      >
        <Activity
          size={24}
          style={{ color: "var(--accent)" }}
        />

        <span>FlowCheck</span>
      </button>

      {isLoggedIn && (
        <div className="nav-links">
          <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => handleNavClick('dashboard')}>대시보드</button>
          <button className={`nav-item ${activeTab === 'domains' ? 'active' : ''}`} onClick={() => handleNavClick('domains')}>도메인 관리</button>
          <button className={`nav-item ${activeTab === 'UIUXTest' ? 'active' : ''}`} onClick={() => handleNavClick('UIUXTest')}>UI/UX 테스트</button>
          <button className={`nav-item ${activeTab === 'load' ? 'active' : ''}`} onClick={() => handleNavClick('load')}>부하 테스트</button>
          <button className={`nav-item ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => handleNavClick('billing')}>크레딧 상점</button>
          <button className={`nav-item ${activeTab === 'community' ? 'active' : ''}`} onClick={() => handleNavClick('community')}>커뮤니티</button>
          <button className={`nav-item ${activeTab === 'comment' ? 'active' : ''}`} onClick={() => handleNavClick('comment')}>게시판</button>
          <button className={`nav-item ${activeTab === 'support' ? 'active' : ''}`} onClick={() => handleNavClick('support')}>문의글 남기기</button>
          {/* {currentUser.role === 'ADMIN' && (
            <button className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => handleNavClick('admin')}>관리자 및 고객지원</button>
          )} */}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        {isLoggedIn ? (
          <>
            <div className="user-profile">
              <span
                style={{
                  color: "var(--text-secondary)",
                }}
              >
                {currentUser.email}
              </span>

              <span className="role-badge">
                {currentUser.role === "ADMIN"
                  ? "관리자"
                  : "일반 사용자"}
              </span>

              <button
                type="button"
                onClick={toggleRole}
                className="btn btn-secondary"
                style={{
                  padding: "0.2rem 0.5rem",
                  fontSize: "0.8rem",
                  borderRadius: "1rem",
                }}
              >
                역할 전환
              </button>
            </div>

            {currentUser.role === "ADMIN" && (
              <button
                type="button"
                onClick={() => handleNavClick("admin")}
                className={getNavClassName("admin")}
              >
                관리자
              </button>
            )}

            <button
              type="button"
              onClick={() => handleNavClick("mypage")}
              className={getNavClassName("mypage")}
            >
              마이페이지
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => handleNavClick("login")}
            className={`nav-item ${activeTab === "login" ||
              activeTab === "signup"
              ? "active"
              : ""
              }`}
          >
            로그인/회원가입
          </button>
        )}
      </div>
    </nav>
  );
}