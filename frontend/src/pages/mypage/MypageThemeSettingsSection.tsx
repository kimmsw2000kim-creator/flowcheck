import styles from '../../styles/mypage.module.css';

function MypageThemeSettingsSection() {
  return (
    <section className={styles['mypage-section']}>
      <h1>테마 설정</h1>
      <p>화면 테마와 표시 환경을 설정합니다.</p>

      <div className={styles['theme-options']}>
        <button type="button" className={`${styles['theme-option']} ${styles.active}`}>
          <span className={`${styles['theme-swatch']} ${styles.light}`}></span>
          라이트
        </button>

        <button type="button" className={styles['theme-option']}>
          <span className={`${styles['theme-swatch']} ${styles.dark}`}></span>
          다크
        </button>

        <button type="button" className={styles['theme-option']}>
          <span className={`${styles['theme-swatch']} ${styles.system}`}></span>
          시스템 설정
        </button>
      </div>
    </section>
  );
}

export default MypageThemeSettingsSection;