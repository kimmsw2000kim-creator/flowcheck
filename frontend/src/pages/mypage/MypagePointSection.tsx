import type { MypageData } from '../../types/mypage';

interface MypagePointSectionProps {
    data: MypageData;
}

function MypagePointSection({ data }: MypagePointSectionProps) {
    return (
        <section className="mypage-section">
            <h1>이용권 · 포인트</h1>
            <p>보유 포인트와 이용권 현황을 확인할 수 있습니다.</p>

            <div className="mypage-section-card">
                <strong>보유 포인트</strong>
                <span>{data.balance.toLocaleString()}P</span>
            </div>

            <div className="mypage-section-card">
                <strong>보유 이용권</strong>
                <span>{data.couponCount}회</span>
            </div>

            {data.couponCount === 0 && (
                <div className="empty-state">
                    <strong>보유한 이용권이 없습니다.</strong>
                    <p>이용권을 구매하거나 이벤트 쿠폰을 등록하면 이곳에 표시됩니다.</p>
                </div>
            )}
        </section>
    );
}

export default MypagePointSection;