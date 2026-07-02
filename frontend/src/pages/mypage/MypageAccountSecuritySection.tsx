function MypageAccountSecuritySection() {
    return (
        <section className="mypage-section">
            <h1>계정 · 보안</h1>
            <p>이메일, 비밀번호, 소셜 로그인 연결 상태를 관리합니다.</p>

            <div className="account-panel">
                <div className="account-row">
                    <div>
                        <strong>이메일</strong>
                        <p>corp-user@flowcheck.com</p>
                    </div>
                    <button type="button" className="btn btn-secondary">변경</button>
                </div>

                <div className="account-row">
                    <div>
                        <strong>비밀번호</strong>
                        <p>보안을 위해 주기적으로 비밀번호를 변경하세요.</p>
                    </div>
                    <button type="button" className="btn btn-secondary">변경</button>
                </div>

                <div className="account-row">
                    <div>
                        <strong>소셜 로그인</strong>
                        <p>카카오 연결 대기 중</p>
                    </div>
                    <button type="button" className="btn btn-secondary">연결 관리</button>
                </div>

                <div className="account-row danger">
                    <div>
                        <strong>로그아웃</strong>
                        <p>현재 기기에서 로그아웃합니다.</p>
                    </div>
                    <button type="button" className="btn btn-secondary">로그아웃</button>
                </div>
            </div>
        </section>
    );
}

export default MypageAccountSecuritySection;