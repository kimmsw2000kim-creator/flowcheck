import { useEffect, useRef, useState } from 'react';
import { Activity, Menu, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { Badge, Button } from './common';

export interface HeaderProps {
  activeTab: string;
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

export default function Header({ activeTab }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { currentUser, authStatus, toggleRole } = useUserStore();
  const isLoggedIn = authStatus === 'authenticated';

  useEffect(() => { setMenuOpen(false); }, [location.pathname, location.hash]);
  useEffect(() => {
    const closeWithKeyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    const closeOutside = (event: MouseEvent) => { if (menuOpen && headerRef.current && !headerRef.current.contains(event.target as Node)) setMenuOpen(false); };
    document.addEventListener('keydown', closeWithKeyboard);
    document.addEventListener('mousedown', closeOutside);
    return () => { document.removeEventListener('keydown', closeWithKeyboard); document.removeEventListener('mousedown', closeOutside); };
  }, [menuOpen]);

  const go = (key: string) => navigate(ROUTES[key] ?? '/dashboard');

  return (
    <header className="app-header" ref={headerRef}>
      <div className="app-header__inner">
        <button type="button" className="app-header__brand" onClick={() => navigate(isLoggedIn ? '/dashboard' : '/')} aria-label="FlowCheck 홈">
          <Activity size={24} aria-hidden="true" /><span>FlowCheck</span>
        </button>
        <button type="button" className="app-header__menu-button" aria-expanded={menuOpen} aria-controls="app-header-menu" onClick={() => setMenuOpen((open) => !open)}>
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
                <div className="app-header__profile"><span>{currentUser.email}</span><Badge tone={currentUser.role === 'ADMIN' ? 'warning' : 'neutral'}>{currentUser.role === 'ADMIN' ? '관리자' : '사용자'}</Badge></div>
                <Button variant="ghost" size="sm" onClick={toggleRole}>역할 전환</Button>
                {currentUser.role === 'ADMIN' && <Button variant={activeTab === 'admin' ? 'primary' : 'secondary'} size="sm" onClick={() => go('admin')}>관리자</Button>}
                <Button variant={activeTab === 'mypage' ? 'primary' : 'secondary'} size="sm" onClick={() => go('mypage')}>마이페이지</Button>
              </>
            ) : (
              <><Button variant="secondary" size="sm" onClick={() => go('login')}>로그인</Button><Button size="sm" onClick={() => go('signup')}>회원가입</Button></>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
