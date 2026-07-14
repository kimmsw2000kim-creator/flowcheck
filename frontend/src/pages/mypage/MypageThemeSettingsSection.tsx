import styles from '../../styles/mypage.module.css';
import {
  useThemeStore,
  type Theme,
} from '../../store/themeStore';

const themeOptions: Array<{
  value: Theme;
  label: string;
}> = [
  { value: 'dark', label: '다크' },
  { value: 'light', label: '화이트' },
  { value: 'system', label: '시스템 설정' },
];

function MypageThemeSettingsSection() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <section className={styles['mypage-section']}>
      <h1>테마 설정</h1>
      <p>화면에 적용할 테마를 선택합니다.</p>

      <div className={styles['theme-options']}>
        {themeOptions.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={theme === value}
            onClick={() => setTheme(value)}
            className={`${styles['theme-option']} ${
              theme === value ? styles.active : ''
            }`}
          >
            <span
              className={`${styles['theme-swatch']} ${styles[value]}`}
            />
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

export default MypageThemeSettingsSection;