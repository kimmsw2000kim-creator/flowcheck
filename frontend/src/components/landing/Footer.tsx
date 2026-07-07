import React from 'react';
import { Globe, MessageSquare, Mail, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="landing-footer">
      <div className="footer-content">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">
            <Activity size={24} style={{ color: 'var(--accent)' }} />
            <span>FlowCheck</span>
          </Link>
          <p className="footer-desc">
            웹 사이트 성능, UI 레이아웃, 실시간 부하를 통합적으로 검증하는 올인원 웹 분석 플랫폼입니다.
          </p>
        </div>

        <div className="footer-links-col">
          <h4 className="footer-col-title">서비스 기능</h4>
          <ul className="footer-links-list">
            <li><Link to="/domains" className="footer-link">도메인 소유권 검증</Link></li>
            <li><Link to="/load" className="footer-link">실시간 부하 테스트</Link></li>
            <li><Link to="/uitest" className="footer-link">UI 회귀 스크린샷 비교</Link></li>
            <li><Link to="/dashboard" className="footer-link">성능 모니터링</Link></li>
          </ul>
        </div>

        <div className="footer-links-col">
          <h4 className="footer-col-title">커뮤니티 & 리소스</h4>
          <ul className="footer-links-list">
            <li><Link to="/community" className="footer-link">프로젝트 쇼케이스</Link></li>
            <li><Link to="/billing" className="footer-link">크레딧 충전 및 요금제</Link></li>
            <li><a href="#" className="footer-link">API 연동 문서</a></li>
            <li><a href="#" className="footer-link">자주 묻는 질문</a></li>
          </ul>
        </div>

        <div className="footer-links-col">
          <h4 className="footer-col-title">법적 고지</h4>
          <ul className="footer-links-list">
            <li><a href="#" className="footer-link">이용약관</a></li>
            <li><a href="#" className="footer-link">개인정보처리방침</a></li>
            <li><a href="#" className="footer-link">서비스수준계약(SLA)</a></li>
            <li><Link to="/mypage" className="footer-link">마이페이지</Link></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-copyright">
          &copy; 2026 FlowCheck Inc. All rights reserved.
        </div>
        <div className="footer-socials">
          <a href="https://github.com" target="_blank" rel="noreferrer" className="social-icon-btn" aria-label="GitHub">
            <Globe size={20} />
          </a>
          <a href="https://twitter.com" target="_blank" rel="noreferrer" className="social-icon-btn" aria-label="Twitter">
            <MessageSquare size={20} />
          </a>
          <a href="mailto:support@flowcheck.site" className="social-icon-btn" aria-label="Email">
            <Mail size={20} />
          </a>
        </div>
      </div>
    </footer>
  );
}
