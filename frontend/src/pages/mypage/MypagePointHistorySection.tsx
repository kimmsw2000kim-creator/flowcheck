function MypagePointHistorySection() {
    return (
        <section className="mypage-section">
            <h1>포인트 내역</h1>
            <p>충전, 사용, 보상 지급 내역을 확인할 수 있습니다.</p>

            <div className="empty-state">
                <strong>포인트 내역이 없습니다.</strong>
                <p>포인트 충전, 테스트 사용, 커뮤니티 보상 내역이 이곳에 표시됩니다.</p>
            </div>
        </section>
    );
}

export default MypagePointHistorySection;