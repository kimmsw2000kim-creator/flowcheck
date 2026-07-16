import { Activity, ArrowRight, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card } from '../common';
import styles from '../../styles/landing.module.css';

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className={styles.hero} aria-labelledby="landing-hero-title">
      <div className={styles['hero-grid']}>
        <div className={styles['hero-copy']}>
          <Badge tone="info" size="md" className={styles['hero-badge']}>
            <Activity size={16} aria-hidden="true" /> Gemini AI 기반 자동 검증
          </Badge>
          <h1 id="landing-hero-title" className={styles['hero-title']}>
            URL 하나로 시작하는<br />AI 성능·UI/UX 테스트
          </h1>
          <p className={styles['hero-description']}>
            복잡한 스크립트 없이 URL과 테스트 조건만 입력하세요. FlowCheck가 부하 테스트와 자율 UI 탐색을 실행하고 이해하기 쉬운 결과를 제공합니다.
          </p>
          <div className={styles['hero-actions']}>
            <Button size="lg" icon={ArrowRight} onClick={() => navigate('/signup')}>무료로 시작하기</Button>
            <Button size="lg" variant="secondary" icon={LogIn} onClick={() => navigate('/login')}>로그인</Button>
          </div>
          <p className={styles['hero-note']}>설치 없이 시작 · 실행별 크레딧 차감 · 결과 이력 보관</p>
        </div>

        <div className={styles['hero-visual']} aria-hidden="true">
          <Card variant="outlined" padding="none" className={styles['terminal-mockup']}>
            <div className={styles['mockup-header']}>
              <div className={styles['mockup-dots']}>
                <span className={`${styles['mockup-dot']} ${styles.red}`} />
                <span className={`${styles['mockup-dot']} ${styles.amber}`} />
                <span className={`${styles['mockup-dot']} ${styles.green}`} />
              </div>
              <span>k6 · load-test.js</span>
            </div>
            <div className={styles['terminal-content']}>
              <p><strong>$</strong> k6 run load-test.js</p>
              <p>execution: local · 50 VUs</p>
              <p className={styles['terminal-success']}>✓ status is 200 · 100.00%</p>
              <p className={styles['terminal-success']}>✓ page load &lt; 500ms · 99.45%</p>
              <p>http_req_duration: avg=112ms max=245ms</p>
            </div>
          </Card>

          <Card variant="outlined" padding="none" className={styles['browser-mockup']}>
            <div className={styles['browser-header']}>
              <div className={styles['mockup-dots']}><span /><span /><span /></div>
              <div className={styles['browser-address']}>● Secure · flowcheck.site/target-url</div>
            </div>
            <div className={styles['browser-body']}>
              <aside className={styles['browser-sidebar']}><span /><span /><span /></aside>
              <div className={styles['browser-main']}>
                <span className={styles.short} /><span className={styles.long} /><span className={styles.medium} />
                <span className={styles['browser-button']} />
                <Badge tone="info" className={styles['agent-badge']}>Gemini Agent · Click</Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
