import { Activity, Globe, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface AppFooterProps {
  variant?: 'full' | 'compact';
}

const REPOSITORY_URL = 'https://github.com/kimmsw2000kim-creator/flowcheck';

export default function AppFooter({ variant = 'compact' }: AppFooterProps) {
  return (
    <footer className="app-footer" data-variant={variant}>
      {variant === 'full' && (
        <div className="app-footer__content">
          <div className="app-footer__brand">
            <Link to="/" className="app-footer__logo"><Activity size={22} aria-hidden="true" /> FlowCheck</Link>
            <p>성능과 UI/UX를 한 흐름에서 검증하고 결과를 관리하는 AI 테스트 플랫폼입니다.</p>
          </div>
          <nav className="app-footer__links" aria-label="서비스 안내">
            <div><h2>제품</h2><a href="/#features">핵심 기능</a><a href="/#showcase">검증 사례</a><a href="/#pricing">요금 안내</a></div>
            <div><h2>시작하기</h2><Link to="/signup">회원가입</Link><Link to="/login">로그인</Link></div>
            <div><h2>연락처</h2><a href={REPOSITORY_URL} target="_blank" rel="noreferrer">GitHub 저장소</a><a href="mailto:support@flowcheck.site">support@flowcheck.site</a></div>
          </nav>
        </div>
      )}
      <div className="app-footer__bottom">
        <p>&copy; 2026 FlowCheck. All rights reserved.</p>
        <div className="app-footer__socials">
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" aria-label="FlowCheck GitHub 저장소"><Globe size={19} aria-hidden="true" /></a>
          <a href="mailto:support@flowcheck.site" aria-label="FlowCheck 이메일 문의"><Mail size={19} aria-hidden="true" /></a>
        </div>
      </div>
    </footer>
  );
}
