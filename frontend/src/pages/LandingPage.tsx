import CommunitySection from '../components/landing/CommunitySection';
import FeatureSection from '../components/landing/FeatureSection';
import HeroSection from '../components/landing/HeroSection';
import PricingSection from '../components/landing/PricingSection';
import styles from '../styles/landing.module.css';

export default function LandingPage() {
  return (
    <div className={styles['landing-container']}>
      <HeroSection />
      <FeatureSection />
      <CommunitySection />
      <PricingSection />
    </div>
  );
}
