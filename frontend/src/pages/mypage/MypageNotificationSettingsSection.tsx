function MypageNotificationSettingsSection() {
    return (
        <section className="mypage-section">
            <h1>알림 설정</h1>
            <p>테스트 완료, 댓글, 결제 관련 알림 설정을 관리합니다.</p>

            <div className="setting-list">
                <label className="setting-row">
                    <div>
                        <strong>테스트 완료 알림</strong>
                        <p>AI QA 또는 부하 테스트가 끝나면 알림을 받습니다.</p>
                    </div>
                    <input type="checkbox" defaultChecked />
                </label>

                <label className="setting-row">
                    <div>
                        <strong>댓글 알림</strong>
                        <p>내 홍보글에 댓글이나 리뷰가 달리면 알림을 받습니다.</p>
                    </div>
                    <input type="checkbox" defaultChecked />
                </label>

                <label className="setting-row">
                    <div>
                        <strong>결제 알림</strong>
                        <p>크레딧 충전과 결제 상태 변경 알림을 받습니다.</p>
                    </div>
                    <input type="checkbox" />
                </label>
            </div>
        </section>
    );
}

export default MypageNotificationSettingsSection;