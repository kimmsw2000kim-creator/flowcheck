import React from 'react';
import { ArrowRight, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/landing.module.css';

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className={styles['hero-wrapper']}>
      <div className={styles['hero-glow-blob']}></div>
      <div className={`${styles['hero-split-grid']} ${styles['animate-fade-in-up']}`}>
        {/* Left Side: Copy and Action Buttons */}
        <div className={styles['hero-left']}>
          <div className={styles['hero-badge']} onClick={() => navigate('/community')}>
            <Activity size={16} />
            <span>Gemini AI 기반 성능 검증 정식 출시!</span>
            <ArrowRight size={14} />
          </div>
          
          <h1 className={styles['hero-title']}>
            URL 하나로 시작하는<br />
            AI 자율 성능/UX 테스트
          </h1>
          
          <p className={styles['hero-description']}>
            복잡한 스크립트 작성은 이제 그만. 타겟 URL만 입력하면 Gemini가 부하 테스트부터 브라우저 자율 탐색, 상세 리포트 생성까지 완벽하게 수행합니다.
          </p>
          
          <div className={styles['hero-cta-group']}>
            <button className={styles['btn-primary']} onClick={() => navigate('/dashboard')}>
              바로 테스트하러 가기
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* Right Side: Beautiful CSS Visual Mockups */}
        <div className={styles['hero-right']}>
          <div className={styles['mockup-container']}>
            {/* Back Overlapping: k6 Terminal Screen */}
            <div className={styles['terminal-mockup']}>
              <div className={styles['terminal-header']}>
                <div className={styles['terminal-dots']}>
                  <span className={styles['terminal-dot']} style={{ backgroundColor: '#ef4444' }}></span>
                  <span className={styles['terminal-dot']} style={{ backgroundColor: '#eab308' }}></span>
                  <span className={styles['terminal-dot']} style={{ backgroundColor: '#22c55e' }}></span>
                </div>
                <div className={styles['terminal-title']}>bash - k6 load_test.js</div>
              </div>
              <div className={styles['terminal-content']}>
                <p><span className={styles['terminal-prompt']}>$</span> k6 run load_test.js</p>
                <p className={styles['terminal-text']}>  execution: local</p>
                <p className={styles['terminal-text']}>  scenarios: (100.00%) 1 scenario, 50 VUs</p>
                <p style={{ margin: '0.25rem 0' }}></p>
                <p className={styles['terminal-success']}>✓ status is 200 ...............: 100.00%</p>
                <p className={styles['terminal-success']}>✓ page_load_time &lt; 500ms ...: 99.45%</p>
                <p style={{ margin: '0.25rem 0' }}></p>
                <p className={styles['terminal-text']}>http_req_duration: avg=112ms max=245ms</p>
                <p className={styles['terminal-text']}>vus_active.......: 50/50 running</p>
              </div>
            </div>

            {/* Front Overlapping: Browser View showing Autonomous Action */}
            <div className={styles['browser-mockup']}>
              <div className={styles['browser-header']}>
                <div className={styles['browser-dots']}>
                  <span className={styles['browser-dot']} style={{ backgroundColor: '#cbd5e1' }}></span>
                  <span className={styles['browser-dot']} style={{ backgroundColor: '#cbd5e1' }}></span>
                  <span className={styles['browser-dot']} style={{ backgroundColor: '#cbd5e1' }}></span>
                </div>
                <div className={styles['browser-address']}>
                  <span style={{ color: 'var(--success)', marginRight: '0.25rem' }}>● Secure</span>
                  <span>https://flowcheck.site/target-url</span>
                </div>
              </div>
              <div className={styles['browser-body']}>
                <div className={styles['browser-sidebar']}>
                  <div className={`${styles['browser-sidebar-item']} ${styles.active}`}></div>
                  <div className={styles['browser-sidebar-item']}></div>
                  <div className={styles['browser-sidebar-item']}></div>
                </div>
                <div className={styles['browser-main']}>
                  <div className={styles['browser-rect']} style={{ width: '40%' }}></div>
                  <div className={styles['browser-rect']} style={{ width: '80%' }}></div>
                  <div className={styles['browser-rect']} style={{ width: '60%' }}></div>
                  
                  <div className={styles['browser-btn']}></div>
                  
                  {/* Floating Gemini Agent Hover Badge */}
                  <div className={styles['gemini-agent-cursor']}>
                    <div className={styles['cursor-pointer-dot']}></div>
                    <div className={styles['cursor-agent-badge']}>
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
