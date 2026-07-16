import { useEffect, useRef, useState } from 'react';
import { Activity, ChevronDown, LogOut, Menu, Monitor, Moon, Sun, UserRound, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useThemeStore, type Theme } from '../store/themeStore';
import { useUserStore } from '../store/userStore';
import { Badge, Button } from './common';

export interface HeaderProps {
  activeTab: string;
  onOpenAuth: (mode: 'login' | 'signup') => void;
}

const AUTH_NAV = [
  ['dashboard', '대시보드'],
  ['domains', '도메인'],
  ['UIUXTest', 'UI/UX 테스트'],
  ['load', '부하 테스트'],
  ['billing', '크레딧'],
  ['community', '커뮤니티'],
  ['support', '문의'],
] as const;

const ROUTES: Record<string, string> = {
  dashboard: '/dashboard', domains: '/domains', UIUXTest: '/UIUXTest', load: '/load', billing: '/billing',
  community: '/community', support: '/support', admin: '/admin', mypage: '/mypage', login: '/login', signup: '/signup',
};

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: '라이트', icon: Sun },
  { value: 'dark', label: '다크', icon: Moon },
  { value: 'system', label: '시스템', icon: Monitor },
];

export default function Header({ activeTab, onOpenAuth }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const { currentUser, authStatus, logout } = useUserStore();
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const isLoggedIn = authStatus === 'authenticated';

  useEffect(() => {
    setMenuOpen(false);
    setProfileMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const closeWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setProfileMenuOpen(false);
      }
    };
    const closeOutside = (event: MouseEvent) => {
      if ((menuOpen || profileMenuOpen) && headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', closeWithKeyboard);
    document.addEventListener('mousedown', closeOutside);
    return () => { document.removeEventListener('keydown', closeWithKeyboard); document.removeEventListener('mousedown', closeOutside); };
  }, [menuOpen, profileMenuOpen]);

  const go = (key: string) => {
    setMenuOpen(false);
    setProfileMenuOpen(false);
    navigate(ROUTES[key] ?? '/dashboard');
  };

  const openAuth = (mode: 'login' | 'signup') => {
    setMenuOpen(false);
    setProfileMenuOpen(false);
    onOpenAuth(mode);
  };

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    await logout();
    // 로그아웃한 사용자는 인증 페이지가 아니라 랜딩페이지로 돌아갑니다.
    navigate('/', { replace: true });
  };

  return (
    <header className="app-header" ref={headerRef}>
      <div className="app-header__inner">
        <button type="button" className="app-header__brand" onClick={() => navigate(isLoggedIn ? '/dashboard' : '/')} aria-label="FlowCheck 홈">
          <Activity size={24} aria-hidden="true" /><span>FlowCheck</span>
        </button>
        <button type="button" className="app-header__menu-button" aria-expanded={menuOpen} aria-controls="app-header-menu" onClick={() => { setMenuOpen((open) => !open); setProfileMenuOpen(false); }}>
          {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}<span className="sr-only">메뉴 {menuOpen ? '닫기' : '열기'}</span>
        </button>

        <div id="app-header-menu" className="app-header__menu" data-open={menuOpen ? 'true' : undefined}>
          <nav className="app-header__nav" aria-label="주요 메뉴">
            {isLoggedIn ? AUTH_NAV.map(([key, label]) => (
              <button key={key} type="button" className="app-header__nav-item" data-active={activeTab === key ? 'true' : undefined} aria-current={activeTab === key ? 'page' : undefined} onClick={() => go(key)}>{label}</button>
            )) : (
              <>
                <a className="app-header__nav-item" href="/#features">핵심 기능</a>
                <a className="app-header__nav-item" href="/#showcase">검증 사례</a>
                <a className="app-header__nav-item" href="/#pricing">요금 안내</a>
              </>
            )}
          </nav>

          <div className="app-header__actions">
            {isLoggedIn ? (
              <>
                {currentUser.role === 'ADMIN' && <Button variant={activeTab === 'admin' ? 'primary' : 'secondary'} size="sm" onClick={() => go('admin')}>관리자</Button>}
                <div className="app-header__profile-menu">
                  <button
                    id="app-header-profile-trigger"
                    type="button"
                    className="app-header__profile-trigger"
                    aria-label="프로필 메뉴"
                    aria-haspopup="true"
                    aria-expanded={profileMenuOpen}
                    aria-controls="app-header-profile-menu"
                    onClick={() => setProfileMenuOpen((open) => !open)}
                  >
                    <UserRound size={19} aria-hidden="true" />
                    <ChevronDown size={15} aria-hidden="true" />
                  </button>

                  {profileMenuOpen && (
                    <div id="app-header-profile-menu" className="app-header__profile-dropdown" aria-labelledby="app-header-profile-trigger">
                      <div className="app-header__profile-summary">
                        <span className="app-header__profile-avatar" aria-hidden="true"><UserRound size={20} /></span>
                        <div className="app-header__profile-details">
                          <strong>{currentUser.email}</strong>
                          <Badge tone={currentUser.role === 'ADMIN' ? 'warning' : 'neutral'}>
                            {currentUser.role === 'ADMIN' ? '관리자' : '사용자'}
                          </Badge>
                        </div>
                      </div>

                      <button type="button" className="app-header__profile-item" onClick={() => go('mypage')}>
                        <UserRound size={17} aria-hidden="true" />
                        <span>마이페이지</span>
                      </button>

                      <div className="app-header__theme-setting">
                        <span className="app-header__theme-label">테마 설정</span>
                        <div className="app-header__theme-options" role="radiogroup" aria-label="화면 테마">
                          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                            <button
                              key={value}
                              type="button"
                              role="radio"
                              aria-checked={theme === value}
                              className="app-header__theme-option"
                              data-active={theme === value ? 'true' : undefined}
                              onClick={() => setTheme(value)}
                            >
                              <Icon size={15} aria-hidden="true" />
                              <span>{label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <button type="button" className="app-header__profile-item app-header__profile-item--danger" onClick={handleLogout}>
                        <LogOut size={17} aria-hidden="true" />
                        <span>로그아웃</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <><Button variant="secondary" size="sm" onClick={() => openAuth('login')}>로그인</Button><Button size="sm" onClick={() => openAuth('signup')}>회원가입</Button></>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
