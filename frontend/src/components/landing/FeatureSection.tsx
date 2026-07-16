import { BadgeCheck, Bot, Zap } from 'lucide-react';
import { Card } from '../common';
import LandingSectionHeader from './LandingSectionHeader';
import styles from '../../styles/landing.module.css';

const FEATURES = [
  { icon: Zap, title: 'AI k6 부하 테스트', description: 'URL과 실행 조건을 바탕으로 부하를 생성하고 처리량, 응답 시간, 오류율을 한눈에 정리합니다.' },
  { icon: Bot, title: 'AI 자율 UI/UX 감사', description: 'AI 에이전트가 브라우저를 직접 탐색하며 사용성 결함과 개선 근거를 영상·점수·보고서로 제공합니다.' },
  { icon: BadgeCheck, title: '검증 이력과 커뮤니티', description: '완료된 테스트 결과를 이력으로 관리하고 검증한 사이트와 결과를 커뮤니티에 공유할 수 있습니다.' },
] as const;

export default function FeatureSection() {
  return (
    <section id="features" className={styles.section}>
      <LandingSectionHeader eyebrow="Core Capabilities" title="FlowCheck 핵심 기능" description="성능과 사용성을 한 흐름에서 검증하고 결과를 축적합니다." />
      <div className={styles['feature-grid']}>
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <Card as="article" key={title} variant="outlined" padding="lg" className={styles['feature-card']}>
            <span className={styles['feature-icon']}><Icon size={26} aria-hidden="true" /></span>
            <h3>{title}</h3><p>{description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
