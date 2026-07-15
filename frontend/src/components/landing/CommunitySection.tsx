import { Award, Check, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card } from '../common';
import LandingSectionHeader from './LandingSectionHeader';
import styles from '../../styles/landing.module.css';

const PROJECTS = [
  { title: 'DevPost · 개발자 포트폴리오', url: 'https://devpost.io', score: 98, uptime: '100%', responseTime: '92 ms', status: 'Excellent' },
  { title: 'ChatSpark · 실시간 채팅 API', url: 'https://chatspark.net', score: 96, uptime: '99.98%', responseTime: '124 ms', status: 'Excellent' },
  { title: 'ShopEasy · 반응형 커머스', url: 'https://shopeasy-demo.dev', score: 95, uptime: '99.95%', responseTime: '180 ms', status: 'Healthy' },
] as const;

export default function CommunitySection() {
  const navigate = useNavigate();
  return (
    <section id="showcase" className={`${styles.section} ${styles['showcase-section']}`}>
      <LandingSectionHeader eyebrow="Verified Showcase" title="검증된 프로젝트 예시" description="FlowCheck의 성능·UI/UX 검증 결과를 요약한 정적 쇼케이스입니다." />
      <div className={styles['showcase-grid']}>
        {PROJECTS.map((project) => (
          <Card as="article" key={project.url} variant="outlined" padding="lg" className={styles['project-card']}>
            <Badge tone="success"><Check size={13} aria-hidden="true" /> FlowCheck Verified</Badge>
            <h3>{project.title}</h3>
            <a className={styles['project-link']} href={project.url} target="_blank" rel="noreferrer">
              {project.url}<ExternalLink size={13} aria-hidden="true" />
            </a>
            <dl className={styles['project-stats']}>
              <div><dt>테스트 점수</dt><dd><Award size={14} aria-hidden="true" /> {project.score}점</dd></div>
              <div><dt>응답 속도</dt><dd>{project.responseTime}</dd></div>
              <div><dt>가동률</dt><dd>{project.uptime}</dd></div>
            </dl>
            <Badge tone={project.status === 'Excellent' ? 'success' : 'info'}>{project.status}</Badge>
          </Card>
        ))}
      </div>
      <div className={styles['section-action']}><Button onClick={() => navigate('/signup')}>내 서비스 검증 시작하기</Button></div>
    </section>
  );
}
