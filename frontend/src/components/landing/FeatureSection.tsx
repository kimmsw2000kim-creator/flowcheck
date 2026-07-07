import React from 'react';
import { Zap, Bot, BadgeCheck } from 'lucide-react';

interface FeatureItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export default function FeatureSection() {
  const features: FeatureItem[] = [
    {
      icon: <Zap size={28} />,
      title: 'AI k6 부하 테스트',
      description: '타겟 URL과 조건만 입력하세요. Gemini가 최적의 k6 스크립트를 생성해 부하를 발생시키고, 실시간 모니터링과 종합 성능 분석 리포트를 제공합니다.'
    },
    {
      icon: <Bot size={28} />,
      title: 'AI 자율 탐색 UI/UX 감사',
      description: '사람처럼 화면을 보고 클릭하는 멀티모달 AI 에이전트가 브라우저를 직접 탐색하며 UI/UX 결함을 찾아내고 개선점을 제안합니다.'
    },
    {
      icon: <BadgeCheck size={28} />,
      title: 'FlowCheck Verified 커뮤니티',
      description: '성공적으로 검증을 마친 프로젝트는 FlowCheck 인증 배지를 획득합니다. 안전성이 입증된 당신의 서비스를 커뮤니티에 등록하고 홍보하세요.'
    }
  ];

  return (
    <section className="landing-section">
      <div className="landing-section-header">
        <span className="landing-section-subtitle">Core Capabilities</span>
        <h2 className="landing-section-title">FlowCheck 핵심 기능</h2>
      </div>

      <div className="features-grid">
        {features.map((feature, idx) => (
          <div 
            key={idx} 
            className="feature-card animate-fade-in-up" 
            style={{ animationDelay: `${(idx + 1) * 150}ms` }}
          >
            <div className="feature-icon-wrapper">
              {feature.icon}
            </div>
            <h3 className="feature-title">{feature.title}</h3>
            <p className="feature-desc">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
