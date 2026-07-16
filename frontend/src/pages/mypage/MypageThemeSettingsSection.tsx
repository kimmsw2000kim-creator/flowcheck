import { PageHeader } from '../../components/common';
import { useThemeStore, type Theme } from '../../store/themeStore';
import styles from '../../styles/mypage.module.css';

const themeOptions: Array<{ value: Theme; label: string; description: string }> = [
  { value: 'light', label: '라이트', description: '밝은 화면으로 표시합니다.' },
  { value: 'dark', label: '다크', description: '어두운 화면으로 표시합니다.' },
  { value: 'system', label: '시스템 설정', description: '기기의 화면 설정을 따릅니다.' },
];

function MypageThemeSettingsSection() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <section className={styles['mypage-section']}>
      <PageHeader headingLevel={1} eyebrow="APPEARANCE" title="테마 설정" description="FlowCheck 화면에 적용할 테마를 선택합니다." />
      <div className={styles['theme-options']} role="radiogroup" aria-label="화면 테마">
        {themeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={theme === option.value}
            onClick={() => setTheme(option.value)}
            className={`${styles['theme-option']} ${theme === option.value ? styles.active : ''}`}
          >
            <span className={`${styles['theme-swatch']} ${styles[option.value]}`} aria-hidden="true" />
            <span><strong>{option.label}</strong><small>{option.description}</small></span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default MypageThemeSettingsSection;
