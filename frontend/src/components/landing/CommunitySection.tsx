import React from 'react';
import { ArrowRight, Check, ExternalLink, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/landing.module.css';

interface MockProject {
  id: number;
  title: string;
  url: string;
  score: number;
  uptime: string;
  responseTime: string;
  status: string;
}

export default function CommunitySection() {
  const navigate = useNavigate();

  const mockProjects: MockProject[] = [
    {
      id: 1,
      title: 'DevPost - 개발자 포트폴리오 플랫폼',
      url: 'https://devpost.io',
      score: 98,
      uptime: '100%',
      responseTime: '92 ms',
      status: 'Excellent'
    },
    {
      id: 2,
      title: 'ChatSpark - 실시간 채팅 API 솔루션',
      url: 'https://chatspark.net',
      score: 96,
      uptime: '99.98%',
      responseTime: '124 ms',
      status: 'Excellent'
    },
    {
      id: 3,
      title: 'ShopEasy - 반응형 커머스 쇼핑몰',
      url: 'https://shopeasy-demo.dev',
      score: 95,
      uptime: '99.95%',
      responseTime: '180 ms',
      status: 'Healthy'
    }
  ];

  return (
    <section className={styles['landing-section']} style={{ background: 'rgba(255, 255, 255, 0.45)', borderRadius: '2rem', padding: '5rem 2rem' }}>
      <div className={styles['landing-section-header']}>
        <span className={styles['landing-section-subtitle']}>FlowCheck Verified Showcase</span>
        <h2 className={styles['landing-section-title']}>검증된 프로젝트를 만나보세요</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', fontSize: '1.05rem' }}>
          FlowCheck 자율 AI 테스트를 성공적으로 통과하고 안전성을 입증한 우수 웹 서비스들을 소개합니다.
        </p>
      </div>

      <div className={styles['community-grid']}>
        {mockProjects.map((project) => (
          <div key={project.id} className={styles['project-card']} style={{ position: 'relative', overflow: 'hidden', border: '1px solid var(--accent-border)' }}>
            
            {/* Prominent FlowCheck Verified Green Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              backgroundColor: '#e6f4ea',
              color: '#137333',
              border: '1px solid #c2e7c9',
              padding: '0.35rem 0.75rem',
              borderRadius: '2rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              width: 'fit-content',
              marginBottom: '1rem',
              boxShadow: '0 2px 6px rgba(19, 115, 51, 0.05)'
            }}>
              <Check size={14} strokeWidth={3} />
              <span>FlowCheck Verified</span>
            </div>

            <div className={styles['project-header']}>
              <h3 className={styles['project-title']} style={{ fontSize: '1.1rem', fontWeight: 700 }}>{project.title}</h3>
            </div>
            
            <div className={styles['project-url']}>
              <a 
                href={project.url} 
                target="_blank" 
                rel="noreferrer" 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', textDecoration: 'none' }}
              >
                {project.url}
                <ExternalLink size={12} />
              </a>
            </div>

            <div className={styles['project-stats']} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '1rem' }}>
              <div className={styles['stat-item']}>
                <span className={styles['stat-label']}>테스트 점수</span>
                <span className={styles['stat-value']} style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                  <Award size={14} />
                  {project.score}점
                </span>
              </div>
              <div className={styles['stat-item']}>
                <span className={styles['stat-label']}>응답 속도</span>
                <span className={styles['stat-value']}>{project.responseTime}</span>
              </div>
              <div className={styles['stat-item']}>
                <span className={styles['stat-label']}>업타임</span>
                <span className={`${styles['stat-value']} ${styles['stat-success']}`}>{project.uptime}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles['community-cta']}>
        <button className={styles['btn-primary']} onClick={() => navigate('/community')}>
          내 서비스 등록하고 검증 받기
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}
