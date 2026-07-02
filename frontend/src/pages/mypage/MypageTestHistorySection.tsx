function MypageTestHistorySection() {
    return (
        <section className="mypage-section">
            <h1>테스트 이력</h1>
            <p>실행한 테스트 목록과 결과 상태를 확인할 수 있습니다.</p>

            <div className="empty-state">
                <strong>실행한 테스트가 없습니다.</strong>
                <p>AI QA 테스트나 부하 테스트를 실행하면 이곳에 기록됩니다.</p>
            </div>
        </section>
    );
}

export default MypageTestHistorySection;