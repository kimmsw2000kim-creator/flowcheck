import React from 'react';
import HeroSection from '../components/landing/HeroSection';
import FeatureSection from '../components/landing/FeatureSection';
import CommunitySection from '../components/landing/CommunitySection';
import PricingSection from '../components/landing/PricingSection';
import Footer from '../components/landing/Footer';

// Load CSS styles for the landing page
import '../styles/landing.css';

export default function LandingPage() {
  return (
    <div className="landing-container">
      {/* 1. HeroSection (메인 상단) */}
      <HeroSection />

      {/* 2. FeatureSection (핵심 기능) */}
      <FeatureSection />

      {/* 3. CommunitySection (유저 프로젝트 홍보) */}
      <CommunitySection />

      {/* 4. PricingSection (요금제) */}
      <PricingSection />

      {/* 5. Footer (하단) */}
      <Footer />
    </div>
  );
}
