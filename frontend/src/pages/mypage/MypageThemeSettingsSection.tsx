function MypageThemeSettingsSection() {
    return (
        <section className="mypage-section">
            <h1>테마 설정</h1>
            <p>화면 테마와 표시 환경을 설정합니다.</p>

            <div className="theme-options">
                <button className="theme-option active">
                    <span className="theme-swatch light"></span>
                    라이트
                </button>

                <button className="theme-option">
                    <span className="theme-swatch dark"></span>
                    다크
                </button>

                <button className="theme-option">
                    <span className="theme-swatch system"></span>
                    시스템 설정
                </button>
            </div>
        </section>
    );
}

export default MypageThemeSettingsSection;