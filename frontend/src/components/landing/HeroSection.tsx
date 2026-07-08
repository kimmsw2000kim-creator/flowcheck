import React from 'react';
import { ArrowRight, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="hero-wrapper">
      <div className="hero-glow-blob"></div>
      <div className="hero-split-grid animate-fade-in-up">
        {/* Left Side: Copy and Action Buttons */}
        <div className="hero-left">
          <div className="hero-badge" onClick={() => navigate('/community')}>
            <Activity size={16} />
            <span>Gemini AI 기반 성능 검증 정식 출시!</span>
            <ArrowRight size={14} />
          </div>
          
          <h1 className="hero-title">
            URL 하나로 시작하는<br />
            AI 자율 성능/UX 테스트
          </h1>
          
          <p className="hero-description">
            복잡한 스크립트 작성은 이제 그만. 타겟 URL만 입력하면 Gemini가 부하 테스트부터 브라우저 자율 탐색, 상세 리포트 생성까지 완벽하게 수행합니다.
          </p>
          
          <div className="hero-cta-group">
            <button className="btn-primary" onClick={() => navigate('/dashboard')}>
              바로 테스트하러 가기
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* Right Side: Beautiful CSS Visual Mockups */}
        <div className="hero-right">
          <div className="mockup-container">
            {/* Back Overlapping: k6 Terminal Screen */}
            <div className="terminal-mockup">
              <div className="terminal-header">
                <div className="terminal-dots">
                  <span className="terminal-dot" style={{ backgroundColor: '#ef4444' }}></span>
                  <span className="terminal-dot" style={{ backgroundColor: '#eab308' }}></span>
                  <span className="terminal-dot" style={{ backgroundColor: '#22c55e' }}></span>
                </div>
                <div className="terminal-title">bash - k6 load_test.js</div>
              </div>
              <div className="terminal-content">
                <p><span className="terminal-prompt">$</span> k6 run load_test.js</p>
                <p className="terminal-text">  execution: local</p>
                <p className="terminal-text">  scenarios: (100.00%) 1 scenario, 50 VUs</p>
                <p style={{ margin: '0.25rem 0' }}></p>
                <p className="terminal-success">✓ status is 200 ...............: 100.00%</p>
                <p className="terminal-success">✓ page_load_time &lt; 500ms ...: 99.45%</p>
                <p style={{ margin: '0.25rem 0' }}></p>
                <p className="terminal-text">http_req_duration: avg=112ms max=245ms</p>
                <p className="terminal-text">vus_active.......: 50/50 running</p>
              </div>
            </div>

            {/* Front Overlapping: Browser View showing Autonomous Action */}
            <div className="browser-mockup">
              <div className="browser-header">
                <div className="browser-dots">
                  <span className="browser-dot" style={{ backgroundColor: '#cbd5e1' }}></span>
                  <span className="browser-dot" style={{ backgroundColor: '#cbd5e1' }}></span>
                  <span className="browser-dot" style={{ backgroundColor: '#cbd5e1' }}></span>
                </div>
                <div className="browser-address">
                  <span style={{ color: 'var(--success)', marginRight: '0.25rem' }}>● Secure</span>
                  <span>https://flowcheck.site/target-url</span>
                </div>
              </div>
              <div className="browser-body">
                <div className="browser-sidebar">
                  <div className="browser-sidebar-item active"></div>
                  <div className="browser-sidebar-item"></div>
                  <div className="browser-sidebar-item"></div>
                </div>
                <div className="browser-main">
                  <div className="browser-rect" style={{ width: '40%' }}></div>
                  <div className="browser-rect" style={{ width: '80%' }}></div>
                  <div className="browser-rect" style={{ width: '60%' }}></div>
                  
                  <div className="browser-btn"></div>
                  
                  {/* Floating Gemini Agent Hover Badge */}
                  <div className="gemini-agent-cursor">
                    <div className="cursor-pointer-dot"></div>
                    <div className="cursor-agent-badge">
                      Gemini Agent: Clicking 'Buy Now'
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
