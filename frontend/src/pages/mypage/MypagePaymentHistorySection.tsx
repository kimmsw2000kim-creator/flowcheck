function MypagePaymentHistorySection() {
    return (
        <section className="mypage-section">
            <h1>결제 내역</h1>
            <p>크레딧 충전과 결제 상태를 확인할 수 있습니다.</p>

            <div className="empty-state">
                <strong>결제 내역이 없습니다.</strong>
                <p>크레딧 충전 요청이나 결제가 발생하면 이곳에 표시됩니다.</p>
            </div>
        </section>
    );
}

export default MypagePaymentHistorySection;